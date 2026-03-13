import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getDBConnection, getAllAcademicEvents } from '../database';
import { useFocusEffect } from '@react-navigation/native';

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

  // Calendar Event States
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [daysUntil, setDaysUntil] = useState(0);
  const [hasAnyEvents, setHasAnyEvents] = useState(true);

  useEffect(() => {
    // Request permission for local notifications
    Notifications.requestPermissionsAsync();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [])
  );

  const loadAnalytics = () => {
    try {
      const db = getDBConnection();
      const history = db.getAllSync("SELECT status FROM attendance_logs");
      
      const total = history.length;
      if (total > 0) {
        const presentCount = history.filter(row => row.status === 'Present').length;
        const percentage = Math.round((presentCount / total) * 100);
        setClassesHeld(total);
        setAttended(presentCount);
        setAttendancePercent(percentage.toString());
      }

      // Load Events
      const allEvents = getAllAcademicEvents();
      if (allEvents.length === 0) {
        setHasAnyEvents(false);
        setUpcomingEvent(null);
      } else {
        setHasAnyEvents(true);
        // Find the next upcoming event from today
        const todayStr = new Date().toISOString().split('T')[0];
        const futureEvents = allEvents.filter(e => e.date >= todayStr);
        
        if (futureEvents.length > 0) {
          const nextEvent = futureEvents[0];
          setUpcomingEvent(nextEvent);
          
          // Calculate days until
          const eventDate = new Date(nextEvent.date);
          const today = new Date(todayStr);
          const diffTime = Math.abs(eventDate - today);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          setDaysUntil(diffDays);
        } else {
          setUpcomingEvent(null);
        }
      }
      
    } catch (err) {
      console.log("No data yet or DB error:", err);
    }
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

      {/* ─── Academic Calendar Section ─── */}
      {!hasAnyEvents ? (
        <TouchableOpacity 
          style={styles.bannerContainer}
          onPress={() => navigation.navigate('Calendar')}
        >
          <Text style={styles.bannerIcon}>📅</Text>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Help us stay accurate!</Text>
            <Text style={styles.bannerSubtext}>
              Upload your college's annual calendar to automatically pause attendance during fests and holidays.
            </Text>
          </View>
        </TouchableOpacity>
      ) : upcomingEvent ? (
        <TouchableOpacity 
          style={styles.upcomingCard}
          onPress={() => navigation.navigate('Calendar')}
        >
          <View style={styles.upcomingHeader}>
            <Text style={styles.upcomingTitle}>🗓️ Upcoming Event</Text>
            <Text style={styles.upcomingDays}>
              {daysUntil === 0 ? 'Today!' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}
            </Text>
          </View>
          <Text style={styles.upcomingName}>{upcomingEvent.title}</Text>
          <Text style={styles.upcomingDate}>
            {upcomingEvent.date} • {upcomingEvent.is_holiday ? 'Holiday' : 'College Event'}
          </Text>
        </TouchableOpacity>
      ) : null}


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
  // ─── Academic Calendar Styles ───
  bannerContainer: {
    backgroundColor: '#e3f2fd',
    borderRadius: 15,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  bannerIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 4,
  },
  bannerSubtext: {
    fontSize: 13,
    color: '#0d47a1',
    lineHeight: 18,
  },
  upcomingCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#9c27b0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase',
  },
  upcomingDays: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff3b30',
  },
  upcomingName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  upcomingDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },

  // ─── Actions ───
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
