import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useAuth } from '../AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { parseTimetableImage, parseAnnualCalendar } from '../geminiAPI';
import { getDBConnection, saveUserClass, addAcademicEvent, saveUserProfile } from '../database';

/**
 * LoginScreen — 3-Step Setup Wizard:
 *   Step 1: Profile (Name, SRN, Branch) — saved to both AsyncStorage & SQLite
 *   Step 2: Timetable Upload (AI-parsed, linked to SRN)
 *   Step 3: Calendar Upload (AI-parsed)
 */
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

    // Save profile to SQLite immediately
    try {
      saveUserProfile({
        name: name.trim(),
        srn: srn.trim().toUpperCase(),
        branch: branch.trim(),
      });
    } catch (e) {
      console.error("Profile save error:", e);
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
        await login(name.trim(), srn.trim().toUpperCase(), branch.trim());
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

  const studentSrn = srn.trim().toUpperCase();

  const processTimetable = async () => {
    await uploadAndProcess(
      parseTimetableImage,
      (cls) => {
        // Map Gemini output keys → database column names, linked to SRN
        const mapped = {
          name: cls.name || 'Unnamed Class',
          day_of_week: cls.day || 'Monday',
          start_time: cls.start_time || '09:00',
          end_time: cls.end_time || '10:00',
          room_name: cls.room || '',
          class_type: cls.type || 'theory',
        };
        saveUserClass(mapped, 'local_user', studentSrn);
      },
      "Timetable successfully saved!",
      3
    );
  };

  const processCalendar = async () => {
    await uploadAndProcess(
      parseAnnualCalendar,
      (evt) => {
        // Handle null titles from AI (illegible fields)
        const mapped = {
          title: evt.title || 'Unknown Event',
          date: evt.date || new Date().toISOString().split('T')[0],
          type: evt.type || 'college_event',
        };
        addAcademicEvent(mapped);
      },
      "Academic calendar successfully synced!",
      'finish'
    );
  };

  const skipToStep3 = () => setStep(3);
  const skipAndFinish = async () => await login(name.trim(), srn.trim().toUpperCase(), branch.trim());

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4a6cf7" />
        <Text style={styles.loadingMessage}>{loadingText}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollInner} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🎓</Text>
        <Text style={styles.title}>Smart Attendance</Text>
        
        {/* Step 1: Profile Setup */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 1 OF 3</Text>
            </View>
            <Text style={styles.stepTitle}>Student Identity</Text>
            <Text style={styles.stepDesc}>This information links your classes and attendance records to your student profile.</Text>
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Swaroop K S" placeholderTextColor="#bbb" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>SRN / Roll Number</Text>
                <TextInput style={styles.input} value={srn} onChangeText={setSrn} autoCapitalize="characters" placeholder="e.g. 1SI22CS001" placeholderTextColor="#bbb" />
                <Text style={styles.hint}>This will be linked to all your attendance records</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Branch / Department</Text>
                <TextInput style={styles.input} placeholder="e.g. B.Tech CSE" placeholderTextColor="#bbb" value={branch} onChangeText={setBranch} />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleNextStep1}>
                <Text style={styles.primaryButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 2: Timetable */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 2 OF 3</Text>
            </View>
            <Text style={styles.stepTitle}>Upload Timetable</Text>
            <Text style={styles.stepDesc}>Upload a screenshot of your class schedule. Our AI will extract and configure your classes for background tracking.</Text>
            
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
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 3 OF 3</Text>
            </View>
            <Text style={styles.stepTitle}>Academic Calendar</Text>
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
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollInner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '800', color: '#1a1a2e', textAlign: 'center', marginBottom: 28, letterSpacing: -0.5 },
  
  stepContainer: { backgroundColor: '#fff', padding: 28, borderRadius: 20, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  stepBadge: { alignSelf: 'flex-start', backgroundColor: '#e8eeff', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 18 },
  stepBadgeText: { fontSize: 11, fontWeight: '700', color: '#4a6cf7', letterSpacing: 1 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  stepDesc: { fontSize: 14, color: '#777', textAlign: 'left', marginBottom: 24, lineHeight: 20 },
  
  form: { gap: 18 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, backgroundColor: '#fafbff', color: '#1a1a2e' },
  hint: { fontSize: 12, color: '#aaa', marginTop: 2, fontStyle: 'italic' },
  
  actionsBox: { gap: 15 },
  primaryButton: { backgroundColor: '#4a6cf7', padding: 17, borderRadius: 14, alignItems: 'center', shadowColor: '#4a6cf7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  skipButton: { padding: 15, alignItems: 'center' },
  skipText: { color: '#888', fontWeight: '600', fontSize: 14 },
  
  loadingMessage: { marginTop: 20, fontSize: 16, color: '#333', fontWeight: '600' }
});
