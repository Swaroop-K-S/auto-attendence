import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Alert, ScrollView, StatusBar
} from 'react-native';
import { useAuth } from '../AuthContext';
import { saveUserProfile } from '../database';

/**
 * ProfileSetupScreen — Dedicated onboarding screen that collects
 * student identity (Name, SRN, Branch) before any access to the app.
 * Data is saved to both AsyncStorage (session) AND SQLite (user_profile table).
 */
export default function ProfileSetupScreen({ onComplete }) {
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [srn, setSrn] = useState('');
  const [branch, setBranch] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !srn.trim() || !branch.trim()) {
      Alert.alert("Required", "Please fill in all fields to continue.");
      return;
    }

    try {
      // Persist to SQLite user_profile table
      saveUserProfile({
        name: name.trim(),
        srn: srn.trim().toUpperCase(),
        branch: branch.trim(),
      });

      // Persist session to AsyncStorage (for nav guard)
      await login(name.trim(), srn.trim().toUpperCase(), branch.trim());

      // Notify parent to move to next step
      if (onComplete) onComplete({ name: name.trim(), srn: srn.trim().toUpperCase(), branch: branch.trim() });
    } catch (error) {
      console.error("Profile setup error:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollInner} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🎓</Text>
        <Text style={styles.title}>Smart Attendance</Text>
        <Text style={styles.subtitle}>Let's personalize your experience</Text>

        <View style={styles.card}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>STEP 1 OF 3</Text>
          </View>

          <Text style={styles.cardTitle}>Student Identity</Text>
          <Text style={styles.cardDesc}>
            This information links your classes and attendance records to your student profile.
          </Text>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput 
                style={styles.input} 
                value={name} 
                onChangeText={setName}
                placeholder="e.g. Swaroop K S"
                placeholderTextColor="#bbb"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>SRN / Roll Number</Text>
              <TextInput 
                style={styles.input} 
                value={srn} 
                onChangeText={setSrn} 
                autoCapitalize="characters"
                placeholder="e.g. 1SI22CS001"
                placeholderTextColor="#bbb"
                autoCorrect={false}
              />
              <Text style={styles.hint}>This will be linked to all your attendance records</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Branch / Department</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. B.Tech CSE" 
                placeholderTextColor="#bbb"
                value={branch} 
                onChangeText={setBranch}
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
              <Text style={styles.primaryButtonText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f0f4ff',
  },
  scrollInner: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: 24,
  },
  emoji: { 
    fontSize: 56, 
    textAlign: 'center', 
    marginBottom: 8,
  },
  title: { 
    fontSize: 30, 
    fontWeight: '800', 
    color: '#1a1a2e', 
    textAlign: 'center', 
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 28,
  },
  card: { 
    backgroundColor: '#fff', 
    padding: 28, 
    borderRadius: 20, 
    shadowColor: '#1a1a2e', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 24, 
    elevation: 8,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8eeff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 18,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4a6cf7',
    letterSpacing: 1,
  },
  cardTitle: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#1a1a2e', 
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: '#777',
    lineHeight: 20,
    marginBottom: 24,
  },
  form: { 
    gap: 18,
  },
  fieldGroup: {
    gap: 6,
  },
  label: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#555', 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: { 
    borderWidth: 1.5, 
    borderColor: '#e2e8f0', 
    borderRadius: 12, 
    padding: 15, 
    fontSize: 16, 
    backgroundColor: '#fafbff',
    color: '#1a1a2e',
  },
  hint: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
    fontStyle: 'italic',
  },
  primaryButton: { 
    backgroundColor: '#4a6cf7', 
    padding: 17, 
    borderRadius: 14, 
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4a6cf7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: { 
    color: '#fff', 
    fontSize: 17, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
