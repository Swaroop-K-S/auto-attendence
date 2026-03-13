import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useAuth } from '../AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { parseTimetableImage, parseAnnualCalendar } from '../geminiAPI';
import { getDBConnection, saveUserClass, addAcademicEvent } from '../database';

export default function LoginScreen() {
  const { login } = useAuth();
  
  // Wizard State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // Step 1 State
  const [name, setName] = useState('');
  const [srn, setSrn] = useState('');
  const [branch, setBranch] = useState('');

  const db = getDBConnection();

  const handleNextStep1 = () => {
    if (!name.trim() || !srn.trim() || !branch.trim()) {
      Alert.alert("Required", "Please fill out all fields to continue.");
      return;
    }
    setStep(2);
  };

  const uploadAndProcess = async (processorFn, dbSaverFn, successMsg, nextStep) => {
    try {
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

      setLoadingText("Analyzing document with AI...");
      setLoading(true);

      const base64Data = await FileSystem.readAsStringAsync(pickerResult.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const parsedItems = await processorFn(base64Data, pickerResult.assets[0].mimeType || 'image/jpeg');
      
      let count = 0;
      db.withTransactionSync(() => {
        parsedItems.forEach(item => {
          dbSaverFn(item);
          count++;
        });
      });

      Alert.alert("Success!", `${successMsg} (${count} items found)`);
      if (nextStep === 'finish') {
        login(name.trim(), srn.trim(), branch.trim());
      } else {
        setStep(nextStep);
      }
    } catch (error) {
      console.error("Setup Error:", error);
      Alert.alert("Parsing Error", error.message || "Failed to process the image. You can try again or skip for now.");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  const processTimetable = async () => {
    await uploadAndProcess(
      parseTimetableImage,
      (cls) => saveUserClass(cls, 'local_user'),
      "Timetable successfully saved!",
      3
    );
  };

  const processCalendar = async () => {
    await uploadAndProcess(
      parseAnnualCalendar,
      (evt) => addAcademicEvent(evt),
      "Academic calendar successfully synced!",
      'finish'
    );
  };

  const skipToStep3 = () => setStep(3);
  const skipAndFinish = () => login(name.trim(), srn.trim(), branch.trim());

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingMessage}>{loadingText}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollInner}>
        <Text style={styles.emoji}>🎓</Text>
        <Text style={styles.title}>Smart Attendance</Text>
        
        {/* Step 1: Profile */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Let's set up your profile</Text>
            <View style={styles.form}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} />

              <Text style={styles.label}>SRN / Roll Number *</Text>
              <TextInput style={styles.input} value={srn} onChangeText={setSrn} autoCapitalize="characters" />

              <Text style={styles.label}>Branch / Course *</Text>
              <TextInput style={styles.input} placeholder="e.g. B.Tech CSE" value={branch} onChangeText={setBranch} />

              <TouchableOpacity style={styles.primaryButton} onPress={handleNextStep1}>
                <Text style={styles.primaryButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 2: Timetable */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Upload Timetable</Text>
            <Text style={styles.stepDesc}>Upload a screenshot of your class schedule. Our AI will automatically extract and configure your classes for background tracking.</Text>
            
            <View style={styles.actionsBox}>
              <TouchableOpacity style={styles.primaryButton} onPress={processTimetable}>
                <Text style={styles.primaryButtonText}>📸 Upload Timetable</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.skipButton} onPress={skipToStep3}>
                <Text style={styles.skipText}>Skip (I'll add manually later)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Calendar */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Final Step: Academic Calendar</Text>
            <Text style={styles.stepDesc}>Upload your college's annual calendar to automatically pause attendance tracking on holidays and highlight exam weeks.</Text>
            
            <View style={styles.actionsBox}>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#4caf50' }]} onPress={processCalendar}>
                <Text style={styles.primaryButtonText}>🗓️ Upload Calendar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.skipButton} onPress={skipAndFinish}>
                <Text style={styles.skipText}>Skip & Go to Dashboard →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollInner: { flexGrow: 1, justifyContent: 'center', padding: 30 },
  emoji: { fontSize: 60, textAlign: 'center', marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center', marginBottom: 30 },
  
  stepContainer: { backgroundColor: '#fff', padding: 25, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 15, textAlign: 'center' },
  stepDesc: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#555' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#fafafa' },
  
  actionsBox: { gap: 15 },
  primaryButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  skipButton: { padding: 15, alignItems: 'center' },
  skipText: { color: '#888', fontWeight: '600', fontSize: 14 },
  
  loadingMessage: { marginTop: 20, fontSize: 16, color: '#333', fontWeight: '600' }
});
