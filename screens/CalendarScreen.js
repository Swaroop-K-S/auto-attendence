import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator 
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { getDBConnection, getEventsForMonth, addAcademicEvent, getAcademicMilestone } from '../database';
import { parseAnnualCalendar } from '../geminiAPI';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from '@react-navigation/native';

export default function CalendarScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7));
  const [isLoading, setIsLoading] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadEvents(currentMonth);
      calculateCurrentWeek();
    }, [currentMonth])
  );

  const calculateCurrentWeek = () => {
    try {
      const startMilestone = getAcademicMilestone('semester_start');
      const endMilestone = getAcademicMilestone('semester_end');
      
      if (startMilestone && startMilestone.date) {
        const today = new Date();
        const startDate = new Date(startMilestone.date);
        
        let endDate = null;
        if (endMilestone && endMilestone.date) {
            endDate = new Date(endMilestone.date);
        }

        // Only calculate if we are within the semester, or if there's no end date defined yet
        if (today >= startDate && (!endDate || today <= endDate)) {
            const diffTime = Math.abs(today - startDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const weekNumber = Math.ceil(diffDays / 7);
            
            // Handle edge case where today is exactly the start date
            setCurrentWeek(weekNumber === 0 ? 1 : weekNumber);
        } else {
            setCurrentWeek(null);
        }
      } else {
        setCurrentWeek(null);
      }
    } catch (e) {
      console.error("Error calculating week", e);
      setCurrentWeek(null);
    }
  };

  const loadEvents = (monthString) => {
    try {
      const results = getEventsForMonth(monthString);
      setEvents(results);

      // Format marked dates for react-native-calendars
      const newMarkedDates = {};
      results.forEach(event => {
        if (!newMarkedDates[event.date]) {
          newMarkedDates[event.date] = { dots: [] };
        }
        
        const isInternal = event.type === 'internal_exam';
        
        // Highlight logic for internal exams
        if (isInternal) {
          newMarkedDates[event.date] = {
            ...newMarkedDates[event.date],
            selected: true,
            selectedColor: '#ffe0b2', // Soft Orange
            selectedTextColor: '#e65100', // Deep Orange text
          };
        }

        const color = event.is_holiday ? '#ff3b30' : (event.type === 'exam' || isInternal ? '#ff9500' : '#007AFF');
        // Prevent duplicate exact same color dots on one day
        if (!newMarkedDates[event.date].dots.find(d => d.color === color)) {
          newMarkedDates[event.date].dots.push({ color });
        }
      });
      setMarkedDates(newMarkedDates);
    } catch (error) {
      console.error("Error loading events", error);
    }
  };

  const handleMonthChange = (date) => {
    setCurrentMonth(date.dateString.substring(0, 7));
  };

  const handleUploadImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Please allow access to your photos.");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (pickerResult.canceled) return;

    processImage(pickerResult.assets[0]);
  };

  const handleUploadCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Please allow access to your camera.");
      return;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (pickerResult.canceled) return;

    processImage(pickerResult.assets[0]);
  };

  const processImage = async (asset) => {
    setIsLoading(true);
    try {
      const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const parsedEvents = await parseAnnualCalendar(base64Data, asset.mimeType || 'image/jpeg');
      
      const db = getDBConnection();
      let savedCount = 0;
      
      db.withTransactionSync(() => {
        parsedEvents.forEach(event => {
          addAcademicEvent({
            title: event.title,
            date: event.date,
            type: event.type
          });
          savedCount++;
        });
      });

      Alert.alert("Success", `Extracted and saved ${savedCount} academic events!`);
      loadEvents(currentMonth); // Refresh data
    } catch (error) {
      console.error("Parsing error:", error);
      Alert.alert("Error", error.message || "Failed to parse the calendar image.");
    } finally {
      setIsLoading(false);
    }
  };

  const promptUploadOptions = () => {
    Alert.alert(
      "Upload Calendar",
      "Take a photo of the college notice board or upload from your gallery.",
      [
        { text: "Camera", onPress: handleUploadCamera },
        { text: "Gallery", onPress: handleUploadImage },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const renderEventItem = ({ item }) => {
    const isHoliday = item.is_holiday;
    const isInternal = item.type === 'internal_exam';
    const isExam = item.type === 'exam' || isInternal;
    
    // Use a distinct orange for internal exams to match the calendar highlight
    const color = isHoliday ? '#ff3b30' : (isInternal ? '#e65100' : (isExam ? '#ff9500' : '#007AFF'));
    const bgColors = isHoliday ? '#ffebee' : (isInternal ? '#ffe0b2' : (isExam ? '#fff3e0' : '#e3f2fd'));

    return (
      <View style={[styles.eventCard, { borderLeftColor: color }]}>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Text style={styles.eventDate}>📅 {item.date}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: bgColors }]}>
          <Text style={[styles.badgeText, { color }]}>
            {isHoliday ? '🏖️ Holiday' : (isInternal ? '📝 Internal' : (isExam ? '📝 Exam' : '🎓 Event'))}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {currentWeek !== null && (
        <View style={styles.weekBanner}>
          <Text style={styles.weekBannerText}>🎓 Week {currentWeek} of the Semester</Text>
        </View>
      )}

      <Calendar
        current={new Date().toISOString().split('T')[0]}
        onMonthChange={handleMonthChange}
        markingType={'multi-dot'}
        markedDates={markedDates}
        theme={{
          selectedDayBackgroundColor: '#007AFF', // Default selected, overridden by specific day markedDates
          todayTextColor: '#007AFF',
          arrowColor: '#007AFF',
        }}
        style={styles.calendar}
      />

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Events this Month</Text>
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyText}>No events recorded for this month.</Text>
          <Text style={styles.emptySub}>Upload your college calendar to auto-sync holidays!</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Upload Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Reading Calendar...</Text>
          </View>
        </View>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={promptUploadOptions}
        disabled={isLoading}
      >
        <Text style={styles.fabIcon}>➕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  weekBanner: {
    backgroundColor: '#e8f5e9', // Soft green background
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
  },
  weekBannerText: {
    color: '#2e7d32', // Dark green text
    fontWeight: 'bold',
    fontSize: 16,
  },
  calendar: {
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 80, // Space for FAB
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  eventDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 30,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 24,
    color: '#fff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
