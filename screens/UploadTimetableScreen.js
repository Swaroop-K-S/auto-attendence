import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { parseTimetableImage, parseAcademicCalendar, parseFestCalendar, resolveMimeType } from '../geminiAPI';
import { getDBConnection, saveUserClass, addAcademicEvent, getUserProfile } from '../database';

/**
 * UploadTimetableScreen — Multi-Document AI Extraction Hub
 * Three distinct upload paths:
 *   1. Timetable → parseTimetableImage → classes table
 *   2. Academic Calendar → parseAcademicCalendar → academic_events (exams/milestones)
 *   3. Fest/Holiday Calendar → parseFestCalendar → academic_events (holidays/fests)
 */
export default function UploadTimetableScreen({ navigation }) {
  const [imageUri, setImageUri] = useState(null);
  const [base64Data, setBase64Data] = useState(null);
  const [fileMimeType, setFileMimeType] = useState('image/jpeg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [activeMode, setActiveMode] = useState(null); // 'timetable' | 'academic' | 'fest'

  // ═══════════════════════════════════════════════════════════════════
  // File Picking
  // ═══════════════════════════════════════════════════════════════════

  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setBase64Data(asset.base64);
      setFileMimeType(resolveMimeType(asset.uri, asset.mimeType));
      setExtractedData(null);
    }
  };

  const pickFromCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setBase64Data(asset.base64);
      setFileMimeType(resolveMimeType(asset.uri, asset.mimeType));
      setExtractedData(null);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setImageUri(file.uri);
        setBase64Data(base64);
        setFileMimeType(resolveMimeType(file.uri, file.mimeType));
        setExtractedData(null);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick document: " + error.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // AI Processing & Routing
  // ═══════════════════════════════════════════════════════════════════

  const processDocument = async (mode) => {
    if (!base64Data) {
      Alert.alert("No File", "Please select an image or document first.");
      return;
    }

    setActiveMode(mode);
    setIsProcessing(true);
    setExtractedData(null);

    const labels = {
      timetable: 'Extracting classes from timetable...',
      academic: 'Scanning for semester dates & exams...',
      fest: 'Extracting holidays & festival dates...',
    };
    setProcessingLabel(labels[mode] || 'Processing...');

    try {
      let results;

      if (mode === 'timetable') {
        results = await parseTimetableImage(base64Data, fileMimeType);
      } else if (mode === 'academic') {
        results = await parseAcademicCalendar(base64Data, fileMimeType);
      } else if (mode === 'fest') {
        results = await parseFestCalendar(base64Data, fileMimeType);
      }

      setExtractedData({ mode, items: results });
      Alert.alert("Success!", `Extracted ${results.length} items. Review below and tap Save.`);
    } catch (error) {
      Alert.alert("Processing Error", error.message);
    } finally {
      setIsProcessing(false);
      setProcessingLabel('');
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Save to Database
  // ═══════════════════════════════════════════════════════════════════

  const saveToDatabase = () => {
    if (!extractedData || !extractedData.items || extractedData.items.length === 0) return;

    try {
      const db = getDBConnection();
      const profile = getUserProfile();
      const studentSrn = profile?.srn || '';
      let savedCount = 0;

      db.withTransactionSync(() => {
        for (const item of extractedData.items) {
          if (extractedData.mode === 'timetable') {
            // Map Gemini keys → DB columns
            const mapped = {
              name: item.name || 'Unnamed Class',
              day_of_week: item.day || 'Monday',
              start_time: item.start_time || '09:00',
              end_time: item.end_time || '10:00',
              room_name: item.room || '',
              class_type: item.type || 'theory',
            };
            saveUserClass(mapped, 'local_user', studentSrn);
          } else {
            // Academic or Fest events → academic_events table
            addAcademicEvent({
              title: item.title || 'Unknown Event',
              date: item.date || new Date().toISOString().split('T')[0],
              type: item.type || 'college_event',
            });
          }
          savedCount++;
        }
      });

      const destination = extractedData.mode === 'timetable' ? 'Timetable' : 'Calendar';
      Alert.alert(
        "Saved!",
        `${savedCount} items have been added successfully.`,
        [{ text: `View ${destination}`, onPress: () => navigation.navigate(destination) }]
      );

      // Reset state
      setImageUri(null);
      setBase64Data(null);
      setExtractedData(null);
      setActiveMode(null);
    } catch (error) {
      Alert.alert("Database Error", "Failed to save: " + error.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.header}>Upload Document</Text>
      <Text style={styles.subtitle}>
        Select a photo, screenshot, or PDF. Then choose the document type to extract data with AI.
      </Text>
      
      {/* ─── File Preview ─── */}
      <TouchableOpacity style={styles.uploadBox} onPress={pickFromGallery} disabled={isProcessing}>
        {imageUri ? (
          fileMimeType === 'application/pdf' ? (
            <View style={styles.pdfPreview}>
              <Text style={styles.pdfIcon}>📄</Text>
              <Text style={styles.pdfLabel}>PDF Document Selected</Text>
            </View>
          ) : (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          )
        ) : (
          <>
            <Text style={styles.uploadIcon}>📸</Text>
            <Text style={styles.uploadText}>Tap to select from gallery</Text>
          </>
        )}
      </TouchableOpacity>

      {/* ─── Source Buttons ─── */}
      <View style={styles.sourceButtons}>
        <TouchableOpacity style={styles.sourceButton} onPress={pickFromCamera} disabled={isProcessing}>
          <Text style={styles.sourceButtonText}>📷 Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sourceButton} onPress={pickDocument} disabled={isProcessing}>
          <Text style={styles.sourceButtonText}>📄 PDF / Files</Text>
        </TouchableOpacity>
      </View>

      {/* ─── AI Routing Buttons (3 distinct paths) ─── */}
      {isProcessing ? (
        <View style={styles.processingCard}>
          <ActivityIndicator size="large" color="#4a6cf7" />
          <Text style={styles.processingText}>{processingLabel}</Text>
        </View>
      ) : (
        <View style={styles.routeSection}>
          <Text style={styles.routeLabel}>What type of document is this?</Text>

          <TouchableOpacity 
            style={[styles.routeButton, styles.routeTimetable, !base64Data && styles.routeDisabled]} 
            onPress={() => processDocument('timetable')}
            disabled={!base64Data}
          >
            <Text style={styles.routeEmoji}>📅</Text>
            <View style={styles.routeTextBox}>
              <Text style={styles.routeTitle}>Upload Timetable</Text>
              <Text style={styles.routeDesc}>Extracts subjects, days & times → Schedule</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.routeButton, styles.routeAcademic, !base64Data && styles.routeDisabled]} 
            onPress={() => processDocument('academic')}
            disabled={!base64Data}
          >
            <Text style={styles.routeEmoji}>🎓</Text>
            <View style={styles.routeTextBox}>
              <Text style={styles.routeTitle}>Upload Academic Calendar</Text>
              <Text style={styles.routeDesc}>Extracts semester dates, exams & milestones</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.routeButton, styles.routeFest, !base64Data && styles.routeDisabled]} 
            onPress={() => processDocument('fest')}
            disabled={!base64Data}
          >
            <Text style={styles.routeEmoji}>🎉</Text>
            <View style={styles.routeTextBox}>
              <Text style={styles.routeTitle}>Upload Fest / Holiday Calendar</Text>
              <Text style={styles.routeDesc}>Extracts holidays, festivals & college events</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Results Preview ─── */}
      {extractedData && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsHeader}>
            {extractedData.items.length} {extractedData.mode === 'timetable' ? 'Classes' : 'Events'} Found
          </Text>
          
          {extractedData.items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <Text style={styles.itemName}>
                {extractedData.mode === 'timetable' ? item.name : item.title}
              </Text>
              <View style={styles.itemDetails}>
                {extractedData.mode === 'timetable' ? (
                  <>
                    <Text style={styles.itemDetail}>📅 {item.day}</Text>
                    <Text style={styles.itemDetail}>🕐 {item.start_time} - {item.end_time}</Text>
                    {item.room ? <Text style={styles.itemDetail}>📍 {item.room}</Text> : null}
                    <View style={[styles.typeBadge, { backgroundColor: item.type === 'lab' ? '#e8d5f5' : '#d5e8f5' }]}>
                      <Text style={[styles.typeBadgeText, { color: item.type === 'lab' ? '#7b1fa2' : '#1565c0' }]}>
                        {item.type === 'lab' ? '🔬 Lab' : '📖 Theory'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.itemDetail}>📅 {item.date}</Text>
                    <View style={[styles.typeBadge, { 
                      backgroundColor: item.type === 'holiday' ? '#fff3e0' : 
                        item.type === 'internal_exam' ? '#fce4ec' : '#e8f5e9' 
                    }]}>
                      <Text style={[styles.typeBadgeText, { 
                        color: item.type === 'holiday' ? '#e65100' : 
                          item.type === 'internal_exam' ? '#c62828' : '#2e7d32' 
                      }]}>
                        {item.type.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.saveButton} onPress={saveToDatabase}>
            <Text style={styles.saveButtonText}>✅ Save All to Database</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* ─── Manual Entry Link ─── */}
      <TouchableOpacity style={styles.textButton} onPress={() => navigation.navigate('ManualEntry')}>
        <Text style={styles.textButtonText}>Enter classes manually instead</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },

  // ─── Preview Box ───
  uploadBox: {
    borderWidth: 2,
    borderColor: '#4a6cf7',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    backgroundColor: '#f8f9ff',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pdfPreview: {
    alignItems: 'center',
    gap: 8,
  },
  pdfIcon: {
    fontSize: 48,
  },
  pdfLabel: {
    fontSize: 15,
    color: '#4a6cf7',
    fontWeight: '600',
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  uploadText: {
    fontSize: 15,
    color: '#4a6cf7',
    fontWeight: '600',
  },

  // ─── Source Buttons ───
  sourceButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  sourceButton: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sourceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  // ─── Route Section ───
  routeSection: {
    gap: 12,
    marginBottom: 20,
  },
  routeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  routeTimetable: { borderColor: '#4a6cf7' },
  routeAcademic: { borderColor: '#e65100' },
  routeFest: { borderColor: '#4caf50' },
  routeDisabled: { opacity: 0.4 },
  routeEmoji: {
    fontSize: 32,
    marginRight: 14,
  },
  routeTextBox: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 3,
  },
  routeDesc: {
    fontSize: 13,
    color: '#888',
  },

  // ─── Processing ───
  processingCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    gap: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  processingText: {
    fontSize: 16,
    color: '#4a6cf7',
    fontWeight: '600',
  },

  // ─── Results ───
  resultsContainer: {
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resultsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 15,
  },
  itemCard: {
    backgroundColor: '#f8f9fa',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  itemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  itemDetail: {
    fontSize: 13,
    color: '#666',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  saveButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  textButton: {
    padding: 12,
    alignItems: 'center',
  },
  textButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
});
