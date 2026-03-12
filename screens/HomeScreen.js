import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getDBConnection } from '../database';

// Configure Notifications to show even when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function HomeScreen({ navigation }) {
  const [attendancePercent, setAttendancePercent] = useState('0');
  const [classesHeld, setClassesHeld] = useState(0);
  const [attended, setAttended] = useState(0);

  useEffect(() => {
    // Request permission for local notifications (Reminders/Confirmations)
    Notifications.requestPermissionsAsync();
    
    // Load Analytics from SQLite
    loadAnalytics();
  }, []);

  const loadAnalytics = () => {
    try {
      const db = getDBConnection();
      // SQLite query to calculate percentages
      const history = db.getAllSync("SELECT status FROM attendance_logs");
      
      const total = history.length;
      if (total === 0) {
        setAttendancePercent('--');
        return;
      }
      
      const presentCount = history.filter(row => row.status === 'Present').length;
      const percentage = Math.round((presentCount / total) * 100);
      
      setClassesHeld(total);
      setAttended(presentCount);
      setAttendancePercent(percentage.toString());
      
    } catch (err) {
      console.log("No data yet or DB error:", err);
    }
  };

  const testNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✅ Attendance Marked!",
        body: "You were successfully marked present for Computer Networks.",
      },
      trigger: null, // trigger immediately
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back!</Text>
      
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{attendancePercent}%</Text>
          <Text style={styles.statLabel}>Overall Attendance</Text>
          <View style={styles.subStats}>
            <Text style={styles.subStatText}>Attended: {attended}</Text>
            <Text style={styles.subStatText}>Total: {classesHeld}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('Timetable')}
        >
          <Text style={styles.buttonText}>View Timetable</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]}
          onPress={() => navigation.navigate('Upload')}
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>Add New Schedule</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={testNotification}
        >
          <Text style={styles.secondaryButtonText}>Test Background Notification 🔔</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  statsContainer: {
    marginBottom: 40,
  },
  statBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    fontWeight: '500',
  },
  subStats: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 15,
    width: '100%',
    justifyContent: 'center',
  },
  subStatText: {
    color: '#888',
    fontSize: 14,
  },
  actionsContainer: {
    gap: 15,
  },
  button: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderWidth: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  primaryButtonText: {
    color: '#fff',
  },
  secondaryButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#666',
    fontWeight: '500',
  }
});
