import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Network from 'expo-network';

export default function AnchorClassScreen({ navigation, route }) {
  // Normally route.params.classId would be passed to tie this anchor to a class
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
      // Note: expo-network doesn't natively expose BSSID on all platforms without ejecting. 
      // For a managed Expo flow, we track the IP state as a basic network check.
      // In a production bare workflow, we'd use react-native-wifi-reborn to strictly grab the BSSID mac address.

      const anchorResult = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
        networkConnected: networkState.isConnected,
        isWifi: networkState.type === Network.NetworkStateType.WIFI,
        ip: ip
      };

      setAnchorData(anchorResult);
      
      Alert.alert(
        "Successfully Anchored",
        `Location set for ${classId}.\nLat: ${anchorResult.lat.toFixed(4)}\nLng: ${anchorResult.lng.toFixed(4)}\nWi-Fi: ${anchorResult.isWifi ? 'Yes' : 'No'}`,
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
      
      // Here you would save anchorResult to Firebase tied to this user and classId

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

      <TouchableOpacity 
        style={[styles.button, isAnchoring && styles.buttonDisabled]} 
        onPress={performAnchoring}
        disabled={isAnchoring}
      >
        {isAnchoring ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Drop Anchor Pin 📍</Text>
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
    marginBottom: 40,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  infoBox: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
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
