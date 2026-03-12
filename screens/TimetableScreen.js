import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { getDBConnection } from '../database';

export default function TimetableScreen({ navigation }) {
  const [schedule, setSchedule] = useState([]);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  useEffect(() => {
    loadSchedule();
  }, [selectedDay]);

  const loadSchedule = () => {
    try {
      const db = getDBConnection();
      const results = db.getAllSync('SELECT * FROM classes WHERE day_of_week = ? ORDER BY start_time ASC', [selectedDay]);
      setSchedule(results);
    } catch (error) {
      console.error("Error loading schedule", error);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.className}>{item.name}</Text>
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Anchor', { classId: item.name })}
        >
          <Text style={styles.actionBtnText}>Set Anchor</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.details}>{item.start_time} - {item.end_time} | {item.room_name}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.daySelector}>
        {days.map(day => (
          <TouchableOpacity 
            key={day} 
            style={[styles.dayTab, selectedDay === day && styles.dayTabActive]}
            onPress={() => setSelectedDay(day)}
          >
            <Text style={[styles.dayTabText, selectedDay === day && styles.dayTabTextActive]}>
              {day.substring(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.dayHeader}>{selectedDay}'s Classes</Text>
      
      {schedule.length === 0 ? (
        <Text style={styles.emptyText}>No classes scheduled or extracted yet!</Text>
      ) : (
        <FlatList
          data={schedule}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dayTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  dayTabActive: {
    backgroundColor: '#007AFF',
  },
  dayTabText: {
    color: '#666',
    fontWeight: '600',
  },
  dayTabTextActive: {
    color: '#fff',
  },
  dayHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  listContainer: {
    padding: 20,
    paddingTop: 0,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#888',
  },
  card: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  className: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    maxWidth: '70%',
  },
  actionBtn: {
    backgroundColor: '#E5F1FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  details: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
