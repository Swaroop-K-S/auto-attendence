import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import { getDBConnection, getActiveClass, isAlreadyMarked } from './database';

const BACKGROUND_VALIDATION_TASK = 'BACKGROUND_ATTENDANCE_VALIDATION_TASK';

/**
 * Haversine Formula: Calculates the distance in meters between two GPS coordinates.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Sends a local notification to the user.
 * @param {string} title 
 * @param {string} body 
 */
async function sendNotification(title, body) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // Fire immediately
  });
}

// 1. Define the Background Task
TaskManager.defineTask(BACKGROUND_VALIDATION_TASK, async () => {
  try {
    const now = new Date();
    
    // Get current day and time in correct formats
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayDate = now.toISOString().split('T')[0]; // "2026-03-12"

    console.log(`[BG Engine] Checking: ${currentDay} ${currentTime}`);

    // 2. Query SQLite for an active class right now
    const activeClass = getActiveClass(currentDay, currentTime);

    if (!activeClass) {
      // No class right now. Immediately sleep to save battery.
      console.log("[BG Engine] No active class found. Sleeping.");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log(`[BG Engine] Active class found: ${activeClass.name}`);

    // 3. Check if we've already marked attendance for this class today
    if (isAlreadyMarked(activeClass.id, todayDate)) {
      console.log(`[BG Engine] Attendance already marked for ${activeClass.name} today.`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 4. Get current GPS location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    // 5. Anti-Spoofing: Check for mock locations
    if (location.mocked) {
      console.log("[BG Engine] SPOOFING DETECTED!");
      const db = getDBConnection();
      db.runSync(
        `INSERT INTO attendance_logs (class_id, date, status, marked_at) VALUES (?, ?, ?, ?)`,
        [activeClass.id, todayDate, 'Spoofed', now.toISOString()]
      );
      await sendNotification(
        "⚠️ Spoofing Detected",
        `Mock location detected for ${activeClass.name}. Marked as Spoofed.`
      );
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    // 6. Calculate distance using Haversine formula
    const distance = getDistance(
      location.coords.latitude,
      location.coords.longitude,
      activeClass.anchor_lat,
      activeClass.anchor_lng
    );

    console.log(`[BG Engine] Distance to anchor: ${distance.toFixed(1)}m`);

    const db = getDBConnection();

    // 7. Check Wi-Fi match (optional secondary verification)
    let wifiMatch = false;
    try {
      const networkState = await Network.getNetworkStateAsync();
      const ip = await Network.getIpAddressAsync();
      if (networkState.type === 'WIFI' && activeClass.anchor_wifi_bssid) {
        wifiMatch = (ip === activeClass.anchor_wifi_bssid);
      }
    } catch (networkErr) {
      console.log("[BG Engine] Could not check Wi-Fi:", networkErr);
    }

    // 8. Final Decision: Mark Present if within 50 meters
    if (distance < 50) {
      db.runSync(
        `INSERT INTO attendance_logs (class_id, date, status, marked_at) VALUES (?, ?, ?, ?)`,
        [activeClass.id, todayDate, 'Present', now.toISOString()]
      );
      await sendNotification(
        "✅ Attendance Marked!",
        `You were marked present for ${activeClass.name}. Distance: ${distance.toFixed(0)}m${wifiMatch ? ' | Wi-Fi ✓' : ''}`
      );
      console.log(`[BG Engine] PRESENT: ${activeClass.name} (${distance.toFixed(0)}m)`);
    } else {
      db.runSync(
        `INSERT INTO attendance_logs (class_id, date, status, marked_at) VALUES (?, ?, ?, ?)`,
        [activeClass.id, todayDate, 'Absent', now.toISOString()]
      );
      await sendNotification(
        "❌ Too Far From Class",
        `You are ${distance.toFixed(0)}m from ${activeClass.name}. Marked as Absent.`
      );
      console.log(`[BG Engine] ABSENT: ${activeClass.name} (${distance.toFixed(0)}m away)`);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("[BG Engine] Background task failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// 2. Register the Task with the OS
export async function registerBackgroundValidationTask() {
  try {
    // Requires Background Location permissions
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.log("Background location denied. Battery-saving validation cannot run.");
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_VALIDATION_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false, // Android only: Keep running after app swipe-kill
      startOnBoot: true,      // Android only: Start when phone reboots
    });
    console.log("Background Validation Engine registered successfully!");
  } catch (err) {
    console.log("Task Register failed:", err);
  }
}

export async function unregisterBackgroundValidationTask() {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_VALIDATION_TASK);
}
