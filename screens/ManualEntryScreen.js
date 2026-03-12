import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { saveUserClass } from '../database';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ManualEntryScreen({ navigation }) {
  const [name, setName] = useState('');
  const [day, setDay] = useState('Monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');
  const [classType, setClassType] = useState('theory');

  const handleSave = () => {
    if (!name || !startTime || !endTime) {
      Alert.alert("Error", "Please fill in all mandatory fields (Name, Start Time, End Time).");
      return;
    }

    // Basic time format validation (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert("Error", "Please use HH:mm format for times (e.g., 09:30).");
      return;
    }

    try {
      saveUserClass({
        name,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        room_name: room,
        class_type: classType,
      });

      Alert.alert("Success", `${classType === 'lab' ? '🔬 Lab' : '📖 Theory'} class added successfully!`, [
        { text: "OK", onPress: () => navigation.navigate('Timetable') }
      ]);
    } catch (error) {
      console.error("Error saving class:", error);
      Alert.alert("Error", "Failed to save class to database.");
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.header}>Add Class Manually</Text>
        
        <View style={styles.form}>
          <Text style={styles.label}>Class Name*</Text>
          <TextInput 
            style={styles.input}
            placeholder="e.g. Computer Networks"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Class Type*</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity 
              style={[styles.typeButton, classType === 'theory' && styles.typeButtonActive]}
              onPress={() => setClassType('theory')}
            >
              <Text style={[styles.typeButtonText, classType === 'theory' && styles.typeButtonTextActive]}>
                📖 Theory
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.typeButton, classType === 'lab' && styles.typeButtonActiveLab]}
              onPress={() => setClassType('lab')}
            >
              <Text style={[styles.typeButtonText, classType === 'lab' && styles.typeButtonTextActive]}>
                🔬 Lab
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Day of Week*</Text>
          <View style={styles.daysContainer}>
            {DAYS.map((d) => (
              <TouchableOpacity 
                key={d} 
                style={[styles.dayButton, day === d && styles.dayButtonActive]}
                onPress={() => setDay(d)}
              >
                <Text style={[styles.dayButtonText, day === d && styles.dayButtonTextActive]}>
                  {d.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Start Time (HH:mm)*</Text>
              <TextInput 
                style={styles.input}
                placeholder="09:00"
                value={startTime}
                onChangeText={setStartTime}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>End Time (HH:mm)*</Text>
              <TextInput 
                style={styles.input}
                placeholder="10:00"
                value={endTime}
                onChangeText={setEndTime}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <Text style={styles.label}>Room Number (Optional)</Text>
          <TextInput 
            style={styles.input}
            placeholder="e.g. B108"
            value={room}
            onChangeText={setRoom}
          />

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Class</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  form: {
    gap: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  row: {
    flexDirection: 'row',
    gap: 15,
  },
  half: {
    flex: 1,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  dayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dayButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dayButtonText: {
    fontSize: 14,
    color: '#666',
  },
  dayButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonActiveLab: {
    backgroundColor: '#ff9800',
    borderColor: '#ff9800',
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
});
