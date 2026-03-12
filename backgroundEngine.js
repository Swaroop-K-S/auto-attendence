import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { getDBConnection } from './database';

const BACKGROUND_VALIDATION_TASK = 'BACKGROUND_ATTENDANCE_VALIDATION_TASK';

// 1. Define the Background Task
TaskManager.defineTask(BACKGROUND_VALIDATION_TASK, async () => {
  try {
    const now = new Date();
    // In a real app, you'd format this securely to compare with SQL rows
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentHourMin = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit' });
    
    // SQLite lookup step
    const db = getDBConnection();
    // This is pseudo-code for the SQL query we will run using expo-sqlite
    // SELECT * FROM classes WHERE day_of_week = currentDay AND start_time >= currentHourMin - 15mins
    
    // For demonstration, let's assume we found a class that just started:
    const activeClassFound = false; // Replace with actual DB result
    
    if (!activeClassFound) {
      // No class right now. Immediately sleep to save battery.
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 2. We have a class! Let's verify location
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    
    if (location.mocked) {
      // Spoofing detected while app was asleep
      console.log("Spoofing detected during background validation.");
      // db.exec(`INSERT INTO attendance_logs (status) VALUES ('Absent (Spoofed)')`)
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    // 3. Verify Wi-Fi network
    const networkState = await Network.getNetworkStateAsync();

    // 4. Final Math: Compare current Lat/Lng with activeClass.anchor_lat/lng
    // If distance < 50 meters AND network matches, mark present!
    // db.exec(`INSERT INTO attendance_logs (status) VALUES ('Present')`)
    console.log("Validation complete.");

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("Background task failed:", error);
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
