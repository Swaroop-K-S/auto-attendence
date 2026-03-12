import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, TextInput, Alert, Pressable 
} from 'react-native';
import { getDBConnection } from '../database';
import { useFocusEffect } from '@react-navigation/native';

export default function TimetableScreen({ navigation }) {
  const [schedule, setSchedule] = useState([]);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editType, setEditType] = useState('theory');

  // Reload schedule when screen comes into focus or day changes
  useFocusEffect(
    useCallback(() => {
      loadSchedule();
    }, [selectedDay])
  );

  const loadSchedule = () => {
    try {
      const db = getDBConnection();
      const results = db.getAllSync(
        'SELECT * FROM classes WHERE day_of_week = ? ORDER BY start_time ASC', 
        [selectedDay]
      );
      setSchedule(results);
    } catch (error) {
      console.error("Error loading schedule", error);
    }
  };

  const openEditModal = (item) => {
    setEditItem(item);
    setEditName(item.name);
    setEditStartTime(item.start_time);
    setEditEndTime(item.end_time);
    setEditRoom(item.room_name || '');
    setEditType(item.class_type || 'theory');
    setEditModalVisible(true);
  };

  const saveEdit = () => {
    if (!editName || !editStartTime || !editEndTime) {
      Alert.alert("Error", "Name, Start Time, and End Time are required.");
      return;
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(editStartTime) || !timeRegex.test(editEndTime)) {
      Alert.alert("Error", "Please use HH:mm format for times.");
      return;
    }

    try {
      const db = getDBConnection();
      db.runSync(
        `UPDATE classes SET name = ?, start_time = ?, end_time = ?, room_name = ?, class_type = ? WHERE id = ?`,
        [editName, editStartTime, editEndTime, editRoom, editType, editItem.id]
      );
      setEditModalVisible(false);
      loadSchedule();
      Alert.alert("Updated", `"${editName}" has been updated.`);
    } catch (error) {
      Alert.alert("Error", "Failed to update class.");
    }
  };

  const deleteClass = () => {
    Alert.alert(
      "Delete Class",
      `Are you sure you want to delete "${editItem.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            try {
              const db = getDBConnection();
              db.runSync('DELETE FROM classes WHERE id = ?', [editItem.id]);
              setEditModalVisible(false);
              loadSchedule();
            } catch (error) {
              Alert.alert("Error", "Failed to delete class.");
            }
          }
        }
      ]
    );
  };

  const getTypeColor = (type) => {
    return type === 'lab' ? '#9c27b0' : '#007AFF';
  };

  const renderItem = ({ item }) => {
    const isLab = item.class_type === 'lab';
    const typeColor = getTypeColor(item.class_type);
    const hasAnchor = item.anchor_lat != null;

    return (
      <Pressable 
        style={[styles.card, { borderLeftColor: typeColor }]}
        onLongPress={() => openEditModal(item)}
        delayLongPress={400}
      >
        <View style={styles.headerRow}>
          <View style={styles.nameRow}>
            <Text style={styles.className}>{item.name}</Text>
            <View style={[styles.badge, { backgroundColor: isLab ? '#f3e5f5' : '#e3f2fd' }]}>
              <Text style={[styles.badgeText, { color: typeColor }]}>
                {isLab ? '🔬 Lab' : '📖 Theory'}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.actionBtn, hasAnchor && styles.actionBtnAnchored]}
            onPress={() => navigation.navigate('Anchor', { classId: item.name })}
          >
            <Text style={[styles.actionBtnText, hasAnchor && styles.actionBtnTextAnchored]}>
              {hasAnchor ? '📍 Anchored' : 'Set Anchor'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailsRow}>
          <Text style={styles.timeText}>🕐 {item.start_time} - {item.end_time}</Text>
          {item.room_name ? <Text style={styles.roomText}>📍 {item.room_name}</Text> : null}
        </View>

        <Text style={styles.longPressHint}>Long press to edit</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Day Selector */}
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

      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.dayHeader}>{selectedDay}'s Classes</Text>
        <Text style={styles.classCount}>{schedule.length} class{schedule.length !== 1 ? 'es' : ''}</Text>
      </View>
      
      {/* Class List */}
      {schedule.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>No classes on {selectedDay}!</Text>
          <Text style={styles.emptySubText}>Upload a timetable or add classes manually.</Text>
        </View>
      ) : (
        <FlatList
          data={schedule}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* ═══ Edit Class Modal ═══ */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Class</Text>

            <Text style={styles.modalLabel}>Class Name</Text>
            <TextInput style={styles.modalInput} value={editName} onChangeText={setEditName} />

            <View style={styles.modalRow}>
              <View style={styles.modalHalf}>
                <Text style={styles.modalLabel}>Start Time</Text>
                <TextInput 
                  style={styles.modalInput} value={editStartTime} 
                  onChangeText={setEditStartTime} placeholder="09:00"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.modalHalf}>
                <Text style={styles.modalLabel}>End Time</Text>
                <TextInput 
                  style={styles.modalInput} value={editEndTime} 
                  onChangeText={setEditEndTime} placeholder="10:00"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text style={styles.modalLabel}>Room</Text>
            <TextInput style={styles.modalInput} value={editRoom} onChangeText={setEditRoom} />

            <Text style={styles.modalLabel}>Class Type</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity 
                style={[styles.typeBtn, editType === 'theory' && styles.typeBtnActiveTheory]}
                onPress={() => setEditType('theory')}
              >
                <Text style={[styles.typeBtnText, editType === 'theory' && styles.typeBtnTextActive]}>
                  📖 Theory
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, editType === 'lab' && styles.typeBtnActiveLab]}
                onPress={() => setEditType('lab')}
              >
                <Text style={[styles.typeBtnText, editType === 'lab' && styles.typeBtnTextActive]}>
                  🔬 Lab
                </Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
              <View style={styles.modalBottomRow}>
                <TouchableOpacity style={styles.deleteBtn} onPress={deleteClass}>
                  <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // ── Day Selector ──────────────────────────────────────
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dayTab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  dayTabActive: { backgroundColor: '#007AFF' },
  dayTabText: { color: '#666', fontWeight: '600', fontSize: 14 },
  dayTabTextActive: { color: '#fff' },

  // ── Header ────────────────────────────────────────────
  headerContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginTop: 20, marginBottom: 10,
  },
  dayHeader: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  classCount: { fontSize: 14, color: '#999', fontWeight: '500' },

  // ── List ──────────────────────────────────────────────
  listContainer: { padding: 20, paddingTop: 0 },

  // ── Empty State ───────────────────────────────────────
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#555' },
  emptySubText: { fontSize: 14, color: '#999', marginTop: 5 },

  // ── Card ──────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08,
    shadowRadius: 3, elevation: 2, borderLeftWidth: 4,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8,
  },
  nameRow: { flex: 1, marginRight: 10 },
  className: { fontSize: 17, fontWeight: '600', color: '#222', marginBottom: 5 },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  detailsRow: { flexDirection: 'row', gap: 15 },
  timeText: { fontSize: 14, color: '#555' },
  roomText: { fontSize: 14, color: '#555' },
  longPressHint: { fontSize: 11, color: '#ccc', marginTop: 8, textAlign: 'right' },

  // ── Anchor Button ─────────────────────────────────────
  actionBtn: {
    backgroundColor: '#E5F1FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  actionBtnAnchored: { backgroundColor: '#e8f5e9' },
  actionBtnText: { color: '#007AFF', fontSize: 11, fontWeight: 'bold' },
  actionBtnTextAnchored: { color: '#4caf50' },

  // ── Modal ─────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 25, paddingBottom: 40,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 5, marginTop: 10 },
  modalInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12,
    fontSize: 16, backgroundColor: '#f9f9f9',
  },
  modalRow: { flexDirection: 'row', gap: 12 },
  modalHalf: { flex: 1 },

  // ── Type Toggle ───────────────────────────────────────
  typeToggle: { flexDirection: 'row', gap: 10, marginTop: 5 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd',
  },
  typeBtnActiveTheory: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  typeBtnActiveLab: { backgroundColor: '#9c27b0', borderColor: '#9c27b0' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
  typeBtnTextActive: { color: '#fff' },

  // ── Modal Actions ─────────────────────────────────────
  modalActions: { marginTop: 20 },
  saveBtn: {
    backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalBottomRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  deleteBtn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#ffcdd2',
  },
  deleteBtnText: { color: '#d32f2f', fontSize: 14, fontWeight: '600' },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0',
  },
  cancelBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
});
