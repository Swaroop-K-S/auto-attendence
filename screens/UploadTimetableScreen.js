import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function UploadTimetableScreen({ navigation }) {
  const [imageUri, setImageUri] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const pickImage = async () => {
    // Request permission first
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos to upload a schedule.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      // In a real app, we would use result.assets[0].base64 to send to OpenAI Vision
    }
  };

  const processImage = async () => {
    if (!imageUri) {
      Alert.alert("No Image", "Please select an image first.");
      return;
    }

    setIsProcessing(true);
    
    // Simulate API Call to OpenAI Vision
    setTimeout(() => {
      setIsProcessing(false);
      Alert.alert(
        "Success!", 
        "Extracted 3 classes from your schedule.",
        [{ text: "View Schedule", onPress: () => navigation.navigate('Timetable') }]
      );
    }, 2500);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Upload Schedule</Text>
      <Text style={styles.subtitle}>Take a photo or upload a screenshot of your timetable. Our AI will automatically extract your classes.</Text>
      
      <TouchableOpacity style={styles.uploadBox} onPress={pickImage} disabled={isProcessing}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <>
            <Text style={styles.uploadIcon}>📸</Text>
            <Text style={styles.uploadText}>Tap to select image</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, isProcessing && styles.buttonDisabled]} 
        onPress={processImage}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Process Image</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.textButton} onPress={() => {Alert.alert("Coming Soon", "Manual entry UI will go here.")}}>
        <Text style={styles.textButtonText}>Enter manually instead</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
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
    marginBottom: 30,
    lineHeight: 22,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
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
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#8cb9f5',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
