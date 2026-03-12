import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { updateClassAnchor } from '../database';

export default function AnchorClassScreen({ navigation, route }) {
  const classId = route?.params?.classId || "Sample Class";
  
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchorData, setAnchorData] = useState(null);

  const performAnchoring = async () => {
    setIsAnchoring(true);
    
    try {
      // 1. Request Permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        setIsAnchoring(false);
        return;
      }

      // 2. Get High-Accuracy GPS Location
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest
      });

      // 3. Security: Check for Mock Locations (Anti-Spoofing)
      if (location.mocked) {
        Alert.alert(
          "Security Alert", 
          "Mock location detected. You cannot use spoofed locations for attendance."
        );
        setIsAnchoring(false);
        return;
      }

      // 4. Get Wi-Fi Information
      let networkState = await Network.getNetworkStateAsync();
      let ip = await Network.getIpAddressAsync();

      const anchorResult = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
        networkConnected: networkState.isConnected,
        isWifi: networkState.type === Network.NetworkStateType.WIFI,
        ip: ip
      };

      // 5. Save to SQLite Database
      const wifiSignature = anchorResult.isWifi ? anchorResult.ip : 'no-wifi';
      updateClassAnchor(classId, anchorResult.lat, anchorResult.lng, wifiSignature);

      setAnchorData(anchorResult);
      
      Alert.alert(
        "✅ Successfully Anchored",
        `Location saved for "${classId}".\n\n` +
        `📍 Lat: ${anchorResult.lat.toFixed(6)}\n` +
        `📍 Lng: ${anchorResult.lng.toFixed(6)}\n` +
        `📶 Wi-Fi: ${anchorResult.isWifi ? 'Connected' : 'Not connected'}\n` +
        `🎯 Accuracy: ${anchorResult.accuracy.toFixed(1)}m\n\n` +
        `Future attendance for this class will be verified automatically using this anchor.`,
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsAnchoring(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Anchor this Class</Text>
      <Text style={styles.subtitle}>
        You must be standing inside the physical classroom. 
        We will record your exact GPS coordinates and the building's Wi-Fi signature to verify future attendance.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Target Class:</Text>
        <Text style={styles.className}>{classId}</Text>
      </View>

      {anchorData && (
        <View style={styles.savedBox}>
          <Text style={styles.savedTitle}>✅ Anchor Saved</Text>
          <Text style={styles.savedDetail}>Lat: {anchorData.lat.toFixed(6)}</Text>
          <Text style={styles.savedDetail}>Lng: {anchorData.lng.toFixed(6)}</Text>
          <Text style={styles.savedDetail}>Wi-Fi: {anchorData.isWifi ? 'Yes' : 'No'}</Text>
          <Text style={styles.savedDetail}>Accuracy: {anchorData.accuracy.toFixed(1)}m</Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.button, isAnchoring && styles.buttonDisabled]} 
        onPress={performAnchoring}
        disabled={isAnchoring}
      >
        {isAnchoring ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {anchorData ? 'Re-Anchor 📍' : 'Drop Anchor Pin 📍'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  infoBox: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  className: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  savedBox: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  savedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  savedDetail: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#8cb9f5',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
