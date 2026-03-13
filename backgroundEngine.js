import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import { getDBConnection, getActiveClass, isAlreadyMarked, getAttendanceLog, updateLastVerified, updateAttendanceExitStatus, getEventByDate, getUserProfile } from './database';

const BACKGROUND_VALIDATION_TASK = 'BACKGROUND_ATTENDANCE_VALIDATION_TASK';

// ═══════════════════════════════════════════════════════════════════════
// Distance Thresholds (meters)
// ═══════════════════════════════════════════════════════════════════════
// Labs have stricter thresholds because indoor GPS drift is higher in
// enclosed lab environments with more electronic interference.
const THRESHOLDS = {
  theory: {
    presentRadius: 50,       // Mark present if within 50m
    earlyLeaveRadius: 100,   // Flag early leave if beyond 100m during session
    accuracy: Location.Accuracy.Balanced,
  },
  lab: {
    presentRadius: 35,       // Labs require closer proximity (35m)
    earlyLeaveRadius: 60,    // Stricter early leave check (60m)
    accuracy: Location.Accuracy.High,  // Higher accuracy for labs
  },
};

/**
 * Gets the appropriate threshold config based on class type.
 * @param {string} classType - 'lab' or 'theory'
 * @returns {object} threshold config
 */
function getThreshold(classType) {
  return THRESHOLDS[classType] || THRESHOLDS.theory;
}

/**
 * Haversine Formula: Calculates the distance in meters between two GPS coordinates.
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Sends a local notification immediately.
 */
async function sendNotification(title, body) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

/**
 * Checks Wi-Fi match against the anchored signature.
 * Returns true if Wi-Fi matches, false otherwise.
 */
async function checkWifiMatch(anchorWifi) {
  try {
    if (!anchorWifi || anchorWifi === 'no-wifi') return false;
    const networkState = await Network.getNetworkStateAsync();
    const ip = await Network.getIpAddressAsync();
    return networkState.type === 'WIFI' && ip === anchorWifi;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Background Task Definition
// ═══════════════════════════════════════════════════════════════════════
TaskManager.defineTask(BACKGROUND_VALIDATION_TASK, async () => {
  try {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayDate = now.toISOString().split('T')[0];

    console.log(`[BG Engine] ──── Wake-up: ${currentDay} ${currentTime} ────`);

    // ── Step 0: Check Academic Calendar for Holidays ───────────────
    const todayEvent = getEventByDate(todayDate);
    if (todayEvent && todayEvent.is_holiday) {
      console.log(`[BG Engine] Skipping: Today is a holiday - ${todayEvent.title}. No checks needed.`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // ── Step 1: Find an active class ────────────────────────────────
    let targetDay = currentDay;

    // ── Alternate Saturday Logic ──
    if (currentDay === 'Saturday') {
      const dateNum = now.getDate();
      const weekNum = Math.ceil(dateNum / 7);

      if (weekNum === 1 || weekNum === 3) {
        console.log(`[BG Engine] Skipping: Week ${weekNum} Saturday is a holiday.`);
        return BackgroundFetch.BackgroundFetchResult.NoData;
      } else {
        const db = getDBConnection();
        const satLogic = db.getFirstSync("SELECT value FROM settings WHERE key = 'saturday_logic'") || { value: 'Monday' };
        targetDay = satLogic.value;
        console.log(`[BG Engine] Alternate Saturday (Week ${weekNum}): Following ${targetDay} timetable.`);
      }
    }

    const activeClass = getActiveClass(targetDay, currentTime);

    if (!activeClass) {
      console.log("[BG Engine] No active class. Sleeping.");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const classType = activeClass.class_type || 'theory';
    const threshold = getThreshold(classType);
    const typeLabel = classType === 'lab' ? '🔬 Lab' : '📖 Theory';

    console.log(`[BG Engine] Active: ${activeClass.name} (${typeLabel}) | Radius: ${threshold.presentRadius}m present / ${threshold.earlyLeaveRadius}m leave`);

    // ── Step A (Time): Already verified — activeClass is the current class ─

    // ── Step B (GPS): Get current location ──────────────────────────
    const location = await Location.getCurrentPositionAsync({
      accuracy: threshold.accuracy,
    });

    // ── Step B.1: Anti-Spoofing ─────────────────────────────────────
    // If location.mocked is true, flag as "Manual Verification Required"
    if (location.mocked) {
      console.log("[BG Engine] MOCK LOCATION DETECTED — flagging for manual verification.");
      const db = getDBConnection();
      const profile = getUserProfile();
      const studentSrn = activeClass.student_srn || profile?.srn || '';
      db.runSync(
        `INSERT INTO attendance_logs (class_id, student_srn, date, status, marked_at, session_end_status) VALUES (?, ?, ?, ?, ?, ?)`,
        [activeClass.id, studentSrn, todayDate, 'Manual Verification Required', now.toISOString(), 'Flagged']
      );
      await sendNotification(
        "⚠️ Manual Verification Required",
        `Mock location detected for ${activeClass.name}. Your attendance has been flagged for manual verification.`
      );
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    // ── Step B.2: Calculate Haversine distance ──────────────────────
    const distance = getDistance(
      location.coords.latitude, location.coords.longitude,
      activeClass.anchor_lat, activeClass.anchor_lng
    );

    // ── Step C (Network): Check Wi-Fi BSSID match ──────────────────
    const wifiMatch = await checkWifiMatch(activeClass.anchor_wifi_bssid);

    console.log(`[BG Engine] Verification: Distance=${distance.toFixed(1)}m | GPS accuracy=${location.coords.accuracy?.toFixed(1)}m | Wi-Fi=${wifiMatch ? '✓' : '✗'}`);

    const db = getDBConnection();

    // ── Step 5: Persistent Session Logic ────────────────────────────
    // Check if we already have an attendance record for this class today
    const existingLog = getAttendanceLog(activeClass.id, todayDate);

    if (existingLog) {
      // ─── RE-VERIFICATION (during ongoing class) ─────────────────
      if (existingLog.status === 'Present') {
        if (distance < threshold.earlyLeaveRadius) {
          // Still in class — update last verified timestamp
          updateLastVerified(existingLog.id);
          
          // Also update to 'Completed' if it was previously flagged
          if (existingLog.session_end_status === 'Left Early') {
            updateAttendanceExitStatus(existingLog.id, 'Completed');
            await sendNotification(
              "✅ Back in Class!",
              `Welcome back to ${activeClass.name}. Status restored to Present.`
            );
            console.log(`[BG Engine] RESTORED: ${activeClass.name} — student returned (${distance.toFixed(0)}m)`);
          } else {
            console.log(`[BG Engine] VERIFIED: Still in ${activeClass.name} (${distance.toFixed(0)}m)`);
          }
        } else {
          // Left early — flag it
          updateAttendanceExitStatus(existingLog.id, 'Left Early');
          await sendNotification(
            "🚶 Early Leave Detected",
            `You appear to have left ${activeClass.name} (${typeLabel}). ` +
            `Distance: ${distance.toFixed(0)}m (threshold: ${threshold.earlyLeaveRadius}m).\n\n` +
            `If this is a GPS error, return to the classroom — we'll re-check in 15 minutes.`
          );
          console.log(`[BG Engine] EARLY LEAVE: ${activeClass.name} (${distance.toFixed(0)}m > ${threshold.earlyLeaveRadius}m)`);
        }
      }
      // If status is 'Absent', 'Manual Verification Required', etc. — don't re-check
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    // ═══════════════════════════════════════════════════════════════
    // FIRST-TIME ATTENDANCE MARKING — 3-Step Verification Result
    // ═══════════════════════════════════════════════════════════════
    const profile = getUserProfile();
    const studentSrn = activeClass.student_srn || profile?.srn || '';

    const gpsOk = distance < threshold.presentRadius;

    if (gpsOk && wifiMatch) {
      // ✅ ALL CHECKS PASSED — Mark as Present
      db.runSync(
        `INSERT INTO attendance_logs (class_id, student_srn, date, status, marked_at, session_end_status, last_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [activeClass.id, studentSrn, todayDate, 'Present', now.toISOString(), 'Completed', now.toISOString()]
      );
      await sendNotification(
        "✅ Attendance Marked!",
        `${typeLabel} ${activeClass.name} — Present!\n` +
        `✓ GPS: ${distance.toFixed(0)}m (within ${threshold.presentRadius}m)\n` +
        `✓ Wi-Fi: Matched\n` +
        `We'll re-verify every 15 minutes.`
      );
      console.log(`[BG Engine] ✓ PRESENT: ${activeClass.name} (${distance.toFixed(0)}m & Wi-Fi OK)`);

    } else if (gpsOk && !wifiMatch) {
      // ⚠️ FRAUD DETECTION: GPS matches but Wi-Fi doesn't
      // This is suspicious — student might be nearby but outside the actual classroom
      db.runSync(
        `INSERT INTO attendance_logs (class_id, student_srn, date, status, marked_at, session_end_status) VALUES (?, ?, ?, ?, ?, ?)`,
        [activeClass.id, studentSrn, todayDate, 'Manual Verification Required', now.toISOString(), 'Flagged']
      );
      await sendNotification(
        "⚠️ Manual Verification Required",
        `${typeLabel} ${activeClass.name}\n` +
        `✓ GPS: ${distance.toFixed(0)}m (within range)\n` +
        `✗ Wi-Fi: Does NOT match anchor BSSID\n\n` +
        `Your attendance has been flagged. Please connect to the classroom Wi-Fi or ask your teacher to verify.`
      );
      console.log(`[BG Engine] ⚠️ FLAGGED: ${activeClass.name} — GPS OK but Wi-Fi mismatch`);

    } else {
      // ❌ GPS too far — Mark as Absent
      db.runSync(
        `INSERT INTO attendance_logs (class_id, student_srn, date, status, marked_at, session_end_status) VALUES (?, ?, ?, ?, ?, ?)`,
        [activeClass.id, studentSrn, todayDate, 'Absent', now.toISOString(), 'N/A']
      );
      await sendNotification(
        "❌ Verification Failed",
        `${typeLabel} ${activeClass.name}\n` +
        `✗ GPS: ${distance.toFixed(0)}m (beyond ${threshold.presentRadius}m)\n` +
        `Marked as Absent.`
      );
      console.log(`[BG Engine] ✗ ABSENT: ${activeClass.name} (${distance.toFixed(0)}m > ${threshold.presentRadius}m)`);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("[BG Engine] Background task failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Task Registration
// ═══════════════════════════════════════════════════════════════════════
export async function registerBackgroundValidationTask() {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.log("Background location denied. Battery-saving validation cannot run.");
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_VALIDATION_TASK, {
      minimumInterval: 15 * 60, // 15 minutes — matches re-verification cycle
      stopOnTerminate: false,   // Android: Keep running after app swipe-kill
      startOnBoot: true,        // Android: Start when phone reboots
    });
    console.log("Background Validation Engine registered successfully (15-min persistent session mode)!");
  } catch (err) {
    console.log("Task Register failed:", err);
  }
}

export async function unregisterBackgroundValidationTask() {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_VALIDATION_TASK);
}
