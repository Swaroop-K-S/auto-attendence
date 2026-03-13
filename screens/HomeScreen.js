import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import * as Notifications from 'expo-notifications';
import { 
  getDBConnection, getAllAcademicEvents, getAcademicMilestone, 
  getSubjectWiseAttendance, getNextUpcomingClass, getActiveClass 
} from '../database';
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
  // ─── Stats ───
  const [attendancePercent, setAttendancePercent] = useState(0);
  const [classesHeld, setClassesHeld] = useState(0);
  const [attended, setAttended] = useState(0);
  const [safeMisses75, setSafeMisses75] = useState(0);
  const [safeMisses85, setSafeMisses85] = useState(0);

  // ─── Per-Subject ───
  const [subjectData, setSubjectData] = useState([]);

  // ─── Next Class & Status ───
  const [nextClass, setNextClass] = useState(null);
  const [currentClass, setCurrentClass] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('idle'); // idle | scanning | verified

  // ─── Calendar ───
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [daysUntil, setDaysUntil] = useState(0);
  const [semesterEndCountdown, setSemesterEndCountdown] = useState(null);

  // ─── Refresh ───
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAnalytics();
    setRefreshing(false);
  }, []);

  const loadAnalytics = () => {
    try {
      const db = getDBConnection();
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // ────────────────────────────────────────────────────────
      // 1. Overall Attendance
      // ────────────────────────────────────────────────────────
      const history = db.getAllSync("SELECT status FROM attendance_logs");
      const total = history.length;
      if (total > 0) {
        const presentCount = history.filter(row => row.status === 'Present').length;
        const percentage = Math.round((presentCount / total) * 100);
        setClassesHeld(total);
        setAttended(presentCount);
        setAttendancePercent(percentage);

        // Safety: misses before dropping below 75%
        const safe75 = Math.floor((presentCount / 0.75) - total);
        setSafeMisses75(safe75 > 0 ? safe75 : 0);

        // Safety: misses before dropping below 85%
        const safe85 = Math.floor((presentCount / 0.85) - total);
        setSafeMisses85(safe85 > 0 ? safe85 : 0);
      } else {
        setClassesHeld(0);
        setAttended(0);
        setAttendancePercent(0);
        setSafeMisses75(0);
        setSafeMisses85(0);
      }

      // ────────────────────────────────────────────────────────
      // 2. Per-Subject Breakdown
      // ────────────────────────────────────────────────────────
      const subjects = getSubjectWiseAttendance();
      setSubjectData(subjects);

      // ────────────────────────────────────────────────────────
      // 3. Next Class & Current Class (real-time status)
      // ────────────────────────────────────────────────────────
      const active = getActiveClass(currentDay, currentTime);
      if (active) {
        setCurrentClass(active);
        setVerificationStatus('scanning');
        setNextClass(null);
      } else {
        setCurrentClass(null);
        setVerificationStatus('idle');
        const upcoming = getNextUpcomingClass(currentDay, currentTime);
        setNextClass(upcoming);
      }

      // ────────────────────────────────────────────────────────
      // 4. Upcoming Event & Semester Countdown
      // ────────────────────────────────────────────────────────
      const allEvents = getAllAcademicEvents();
      if (allEvents.length > 0) {
        const futureEvents = allEvents.filter(e => e.date >= todayStr);
        let priorityEvent = futureEvents.find(e => e.type === 'internal_exam');
        if (!priorityEvent && futureEvents.length > 0) priorityEvent = futureEvents[0];

        if (priorityEvent) {
          setUpcomingEvent(priorityEvent);
          const diffDays = Math.ceil(Math.abs(new Date(priorityEvent.date) - new Date(todayStr)) / 86400000);
          setDaysUntil(diffDays);
        } else {
          setUpcomingEvent(null);
        }
      } else {
        setUpcomingEvent(null);
      }

      const endMilestone = getAcademicMilestone('semester_end');
      const startMilestone = getAcademicMilestone('semester_start');
      if (startMilestone && endMilestone && todayStr >= startMilestone.date && todayStr <= endMilestone.date) {
        const diffDays = Math.ceil(Math.abs(new Date(endMilestone.date) - new Date(todayStr)) / 86400000);
        setSemesterEndCountdown(diffDays);
      } else {
        setSemesterEndCountdown(null);
      }

    } catch (err) {
      console.log("Dashboard analytics error:", err);
    }
  };

  // ─── Helper: Color based on percentage ───
  const getPercentColor = (pct) => {
    if (pct >= 85) return '#2e7d32';
    if (pct >= 75) return '#e65100';
    return '#d32f2f';
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4a6cf7" />}
    >
      {/* ═══ Real-Time Status Banner ═══ */}
      {currentClass ? (
        <View style={styles.statusBanner}>
          <View style={styles.statusDot} />
          <View style={styles.statusTextBox}>
            <Text style={styles.statusLabel}>LIVE — Verifying</Text>
            <Text style={styles.statusClass}>{currentClass.name}</Text>
            <Text style={styles.statusDetail}>
              {currentClass.class_type === 'lab' ? '🔬' : '📖'} {currentClass.start_time} - {currentClass.end_time} • Scanning Wi-Fi & GPS...
            </Text>
          </View>
        </View>
      ) : nextClass ? (
        <View style={[styles.statusBanner, { backgroundColor: '#f0f4ff', borderColor: '#c5cae9' }]}>
          <Text style={styles.nextClassEmoji}>{nextClass.class_type === 'lab' ? '🔬' : '📖'}</Text>
          <View style={styles.statusTextBox}>
            <Text style={[styles.statusLabel, { color: '#4a6cf7' }]}>NEXT CLASS</Text>
            <Text style={[styles.statusClass, { color: '#1a1a2e' }]}>{nextClass.name}</Text>
            <Text style={styles.statusDetail}>
              {nextClass.isToday ? 'Today' : nextClass.nextDay || nextClass.day_of_week} at {nextClass.start_time}
              {nextClass.room_name ? ` • ${nextClass.room_name}` : ''}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ═══ Overall Stats Row ═══ */}
      <View style={styles.statsRow}>
        <View style={styles.overallCard}>
          <View style={styles.percentRing}>
            <Text style={[styles.percentText, { color: getPercentColor(attendancePercent) }]}>
              {attendancePercent}%
            </Text>
          </View>
          <Text style={styles.overallLabel}>Overall</Text>
          <Text style={styles.overallSub}>✓ {attended} / {classesHeld}</Text>
        </View>

        <View style={styles.safetyColumn}>
          <View style={[styles.safetyCard, { backgroundColor: safeMisses75 > 0 ? '#e8f5e9' : '#ffebee' }]}>
            <Text style={[styles.safetyNumber, { color: safeMisses75 > 0 ? '#2e7d32' : '#d32f2f' }]}>
              {safeMisses75}
            </Text>
            <Text style={styles.safetyLabel}>Before {'<'} 75%</Text>
          </View>
          <View style={[styles.safetyCard, { backgroundColor: safeMisses85 > 0 ? '#e3f2fd' : '#fff3e0' }]}>
            <Text style={[styles.safetyNumber, { color: safeMisses85 > 0 ? '#1565c0' : '#e65100' }]}>
              {safeMisses85}
            </Text>
            <Text style={styles.safetyLabel}>Before {'<'} 85%</Text>
          </View>
        </View>
      </View>

      {/* ═══ Per-Subject Attendance Bars ═══ */}
      {subjectData.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📊 Subject-Wise Attendance</Text>
          {subjectData.map((subject, index) => (
            <View key={index} style={styles.subjectRow}>
              <View style={styles.subjectHeader}>
                <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>
                <Text style={[styles.subjectPercent, { color: getPercentColor(subject.percentage) }]}>
                  {subject.percentage}%
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View 
                  style={[
                    styles.barFill, 
                    { 
                      width: `${Math.min(subject.percentage, 100)}%`,
                      backgroundColor: getPercentColor(subject.percentage),
                    }
                  ]} 
                />
                {/* 75% marker line */}
                <View style={styles.thresholdLine75} />
              </View>
              <Text style={styles.subjectCount}>{subject.attended}/{subject.total} classes</Text>
            </View>
          ))}
        </View>
      )}

      {/* ═══ Upcoming Event / Semester Countdown ═══ */}
      {upcomingEvent && (
        <TouchableOpacity 
          style={styles.eventCard}
          onPress={() => navigation.navigate('Calendar')}
        >
          <View style={styles.eventHeader}>
            <Text style={[styles.eventType, upcomingEvent.type === 'internal_exam' && { color: '#e65100' }]}>
              {upcomingEvent.type === 'internal_exam' ? '🚨 INTERNAL EXAM' : '🗓️ UPCOMING'}
            </Text>
            <Text style={styles.eventDays}>
              {daysUntil === 0 ? 'Today!' : `in ${daysUntil}d`}
            </Text>
          </View>
          <Text style={styles.eventName}>{upcomingEvent.title}</Text>
          <Text style={styles.eventDate}>{upcomingEvent.date}</Text>
        </TouchableOpacity>
      )}

      {semesterEndCountdown !== null && (
        <View style={[styles.eventCard, { borderLeftColor: '#4caf50' }]}>
          <Text style={[styles.eventType, { color: '#2e7d32' }]}>🏁 SEMESTER</Text>
          <Text style={styles.eventName}>{semesterEndCountdown} days remaining</Text>
        </View>
      )}

      {/* ═══ Quick Actions ═══ */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Timetable')}>
          <Text style={styles.actionEmoji}>📅</Text>
          <Text style={styles.actionLabel}>Timetable</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Upload')}>
          <Text style={styles.actionEmoji}>➕</Text>
          <Text style={styles.actionLabel}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Calendar')}>
          <Text style={styles.actionEmoji}>🗓️</Text>
          <Text style={styles.actionLabel}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.actionEmoji}>👤</Text>
          <Text style={styles.actionLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // ─── Status Banner ───
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4caf50',
    marginRight: 14,
  },
  nextClassEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  statusTextBox: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2e7d32',
    letterSpacing: 1,
    marginBottom: 2,
  },
  statusClass: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 2,
  },
  statusDetail: {
    fontSize: 12,
    color: '#666',
  },

  // ─── Stats Row ───
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  overallCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  percentRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  percentText: {
    fontSize: 24,
    fontWeight: '800',
  },
  overallLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overallSub: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },

  // ─── Safety Cards ───
  safetyColumn: {
    gap: 10,
    justifyContent: 'center',
  },
  safetyCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  safetyNumber: {
    fontSize: 28,
    fontWeight: '800',
  },
  safetyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    marginTop: 2,
  },

  // ─── Subject Bars ───
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  subjectRow: {
    marginBottom: 14,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  subjectPercent: {
    fontSize: 14,
    fontWeight: '800',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#f0f0f5',
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  thresholdLine75: {
    position: 'absolute',
    left: '75%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  subjectCount: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 3,
  },

  // ─── Event Card ───
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#9c27b0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 0.5,
  },
  eventDays: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff3b30',
  },
  eventName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  eventDate: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
  },

  // ─── Quick Actions ───
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e8ecf4',
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
});
