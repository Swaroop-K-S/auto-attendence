import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { parseTimetableImage } from '../geminiAPI';
import { getDBConnection } from '../database';

export default function UploadTimetableScreen({ navigation }) {
  const [imageUri, setImageUri] = useState(null);
  const [base64Data, setBase64Data] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedClasses, setExtractedClasses] = useState(null);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos to upload a schedule.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setBase64Data(result.assets[0].base64);
      setExtractedClasses(null);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow camera access to take a photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setBase64Data(result.assets[0].base64);
      setExtractedClasses(null);
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
        const fileUri = file.uri;
        
        // Read as base64
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        setImageUri(fileUri);
        setBase64Data(base64);
        setExtractedClasses(null);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick document: " + error.message);
    }
  };

  const processImage = async () => {
    if (!base64Data) {
      Alert.alert("No Image", "Please select an image or document first.");
      return;
    }

    setIsProcessing(true);
    setExtractedClasses(null);

    try {
      const classes = await parseTimetableImage(base64Data);
      setExtractedClasses(classes);
      
      Alert.alert(
        "Classes Found!",
        `Extracted ${classes.length} classes from your timetable. Review them below and tap "Save to Database" to add them to your schedule.`
      );
    } catch (error) {
      Alert.alert("Processing Error", error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToDatabase = () => {
    if (!extractedClasses || extractedClasses.length === 0) return;

    try {
      const db = getDBConnection();
      
      let savedCount = 0;
      for (const cls of extractedClasses) {
        db.runSync(
          `INSERT INTO classes (name, day_of_week, start_time, end_time, room_name) VALUES (?, ?, ?, ?, ?)`,
          [cls.name, cls.day, cls.start_time, cls.end_time, cls.room]
        );
        savedCount++;
      }

      Alert.alert(
        "Saved!",
        `${savedCount} classes have been added to your schedule.`,
        [{ text: "View Schedule", onPress: () => navigation.navigate('Timetable') }]
      );

      // Reset state
      setImageUri(null);
      setBase64Data(null);
      setExtractedClasses(null);
    } catch (error) {
      Alert.alert("Database Error", "Failed to save classes: " + error.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.header}>Upload Schedule</Text>
      <Text style={styles.subtitle}>
        Take a photo or upload a screenshot of your timetable. Gemini AI will automatically extract your classes.
      </Text>
      
      {/* Image Preview */}
      <TouchableOpacity style={styles.uploadBox} onPress={pickImage} disabled={isProcessing}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <>
            <Text style={styles.uploadIcon}>📸</Text>
            <Text style={styles.uploadText}>Tap to select from gallery</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Source Buttons */}
      <View style={styles.sourceButtons}>
        <TouchableOpacity 
          style={styles.sourceButton} 
          onPress={takePhoto} 
          disabled={isProcessing}
        >
          <Text style={styles.sourceButtonText}>📷 Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.sourceButton} 
          onPress={pickDocument} 
          disabled={isProcessing}
        >
          <Text style={styles.sourceButtonText}>📄 Document</Text>
        </TouchableOpacity>
      </View>

      {/* Process Button */}
      <TouchableOpacity 
        style={[styles.button, (!base64Data || isProcessing) && styles.buttonDisabled]} 
        onPress={processImage}
        disabled={!base64Data || isProcessing}
      >
        {isProcessing ? (
          <View style={styles.processingRow}>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.buttonText, {marginLeft: 10}]}>Analyzing with Gemini AI...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>🧠 Process with AI</Text>
        )}
      </TouchableOpacity>

      {/* Extracted Classes Preview */}
      {extractedClasses && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsHeader}>
            {extractedClasses.length} Classes Found
          </Text>
          
          {extractedClasses.map((cls, index) => (
            <View key={index} style={styles.classCard}>
              <Text style={styles.className}>{cls.name}</Text>
              <View style={styles.classDetails}>
                <Text style={styles.classDetail}>📅 {cls.day}</Text>
                <Text style={styles.classDetail}>🕐 {cls.start_time} - {cls.end_time}</Text>
                {cls.room ? <Text style={styles.classDetail}>📍 {cls.room}</Text> : null}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.saveButton} onPress={saveToDatabase}>
            <Text style={styles.saveButtonText}>✅ Save All to Database</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Manual Entry Link */}
      <TouchableOpacity style={styles.textButton} onPress={() => navigation.navigate('ManualEntry')}>
        <Text style={styles.textButtonText}>Enter manually instead</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  uploadText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  sourceButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  sourceButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sourceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#b0b0b0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultsContainer: {
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: '#f8fff8',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  resultsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 15,
  },
  classCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  classDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  classDetail: {
    fontSize: 13,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  textButton: {
    padding: 10,
    alignItems: 'center',
  },
  textButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
});
