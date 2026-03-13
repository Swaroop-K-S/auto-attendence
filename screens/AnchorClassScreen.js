import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { updateClassAnchor } from '../database';

/**
 * AnchorClassScreen — Captures the "Anchor Tag" for a classroom.
 * When a student is physically in class, this screen records:
 *   1. anchor_lat & anchor_lng (GPS Coordinates)
 *   2. anchor_wifi_bssid (Wi-Fi router signature / BSSID proxy)
 *
 * These are later used by the Background Engine for 3-step verification.
 */
export default function AnchorClassScreen({ navigation, route }) {
  const className = route?.params?.classId || "Sample Class";
  
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchorData, setAnchorData] = useState(null);
  const [currentNetwork, setCurrentNetwork] = useState(null);

  // Show current network info when screen loads
  useEffect(() => {
    (async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const ip = await Network.getIpAddressAsync();
        setCurrentNetwork({
          connected: networkState.isConnected,
          isWifi: networkState.type === Network.NetworkStateType.WIFI,
          ip,
        });
      } catch (e) {
        setCurrentNetwork(null);
      }
    })();
  }, []);

  const performAnchoring = async () => {
    setIsAnchoring(true);
    
    try {
      // ─── Step 1: Request Permissions ───
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to anchor a classroom.');
        setIsAnchoring(false);
        return;
      }

      // ─── Step 2: Capture GPS Coordinates (High Accuracy) ───
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      // ─── Step 3: Anti-Spoofing Check ───
      if (location.mocked) {
        Alert.alert(
          "🚫 Security Alert", 
          "Mock location detected! You cannot anchor a classroom with a spoofed GPS position.\n\nDisable developer mock locations and try again."
        );
        setIsAnchoring(false);
        return;
      }

      // ─── Step 4: Capture Wi-Fi BSSID (Network Signature) ───
      const networkState = await Network.getNetworkStateAsync();
      const ip = await Network.getIpAddressAsync();

      const isWifi = networkState.type === Network.NetworkStateType.WIFI;
      const wifiBssid = isWifi ? ip : 'no-wifi';

      if (!isWifi) {
        Alert.alert(
          "Wi-Fi Required",
          "You are not connected to Wi-Fi. For best verification accuracy, connect to the classroom Wi-Fi router before anchoring.\n\nDo you want to continue without Wi-Fi?",
          [
            { text: "Cancel", style: "cancel", onPress: () => setIsAnchoring(false) },
            { text: "Continue Anyway", onPress: () => saveAnchor(location, wifiBssid, false) },
          ]
        );
        return;
      }

      saveAnchor(location, wifiBssid, true);

    } catch (error) {
      Alert.alert('Anchor Error', error.message);
      setIsAnchoring(false);
    }
  };

  const saveAnchor = (location, wifiBssid, wifiConnected) => {
    try {
      const result = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
        wifiBssid,
        wifiConnected,
      };

      // Save to SQLite
      updateClassAnchor(className, result.lat, result.lng, result.wifiBssid);
      setAnchorData(result);

      Alert.alert(
        "✅ Anchor Tag Created",
        `Classroom "${className}" has been anchored!\n\n` +
        `📍 GPS: ${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}\n` +
        `🎯 Accuracy: ${result.accuracy.toFixed(1)}m\n` +
        `📶 Wi-Fi BSSID: ${wifiConnected ? wifiBssid : 'Not captured'}\n\n` +
        `Future attendance will be verified using:\n` +
        `  ✓ GPS within 50m of this point\n` +
        `  ✓ Same Wi-Fi network signature\n` +
        `  ✓ No mock locations detected`,
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Database Error", "Failed to save anchor: " + error.message);
    } finally {
      setIsAnchoring(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.header}>⚓ Anchor Classroom</Text>
      <Text style={styles.subtitle}>
        Stand inside the physical classroom while creating this anchor. We'll capture your exact GPS coordinates and the Wi-Fi router's unique signature.
      </Text>

      {/* ─── Target Class ─── */}
      <View style={styles.targetCard}>
        <Text style={styles.targetLabel}>TARGET CLASS</Text>
        <Text style={styles.targetName}>{className}</Text>
      </View>

      {/* ─── Current Network Status ─── */}
      {currentNetwork && (
        <View style={[styles.networkCard, { borderColor: currentNetwork.isWifi ? '#4caf50' : '#ff9800' }]}>
          <Text style={styles.networkTitle}>
            {currentNetwork.isWifi ? '📶 Wi-Fi Connected' : '📱 Mobile Data'}
          </Text>
          <View style={styles.networkRow}>
            <Text style={styles.networkLabel}>Network:</Text>
            <Text style={styles.networkValue}>
              {currentNetwork.isWifi ? 'Wi-Fi' : 'Cellular'}
            </Text>
          </View>
          {currentNetwork.isWifi && (
            <View style={styles.networkRow}>
              <Text style={styles.networkLabel}>BSSID Signature:</Text>
              <Text style={[styles.networkValue, { fontFamily: 'monospace' }]}>
                {currentNetwork.ip}
              </Text>
            </View>
          )}
          {!currentNetwork.isWifi && (
            <Text style={styles.networkWarning}>
              ⚠️ Connect to the classroom Wi-Fi for best accuracy
            </Text>
          )}
        </View>
      )}

      {/* ─── Verification Steps Info ─── */}
      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>How verification works</Text>
        <View style={styles.stepRow}>
          <Text style={styles.stepBadge}>A</Text>
          <View style={styles.stepTextBox}>
            <Text style={styles.stepLabel}>Time Check</Text>
            <Text style={styles.stepDesc}>Is there a class scheduled right now?</Text>
          </View>
        </View>
        <View style={styles.stepRow}>
          <Text style={[styles.stepBadge, { backgroundColor: '#e8f5e9', color: '#2e7d32' }]}>B</Text>
          <View style={styles.stepTextBox}>
            <Text style={styles.stepLabel}>GPS Check (Haversine)</Text>
            <Text style={styles.stepDesc}>Are you within 50m of this anchor point?</Text>
          </View>
        </View>
        <View style={styles.stepRow}>
          <Text style={[styles.stepBadge, { backgroundColor: '#e3f2fd', color: '#1565c0' }]}>C</Text>
          <View style={styles.stepTextBox}>
            <Text style={styles.stepLabel}>Network Check</Text>
            <Text style={styles.stepDesc}>Does your BSSID match the anchor BSSID?</Text>
          </View>
        </View>
      </View>

      {/* ─── Saved Anchor ─── */}
      {anchorData && (
        <View style={styles.savedCard}>
          <Text style={styles.savedTitle}>✅ Anchor Data Captured</Text>
          <View style={styles.savedRow}>
            <Text style={styles.savedLabel}>Latitude</Text>
            <Text style={styles.savedValue}>{anchorData.lat.toFixed(6)}</Text>
          </View>
          <View style={styles.savedRow}>
            <Text style={styles.savedLabel}>Longitude</Text>
            <Text style={styles.savedValue}>{anchorData.lng.toFixed(6)}</Text>
          </View>
          <View style={styles.savedRow}>
            <Text style={styles.savedLabel}>GPS Accuracy</Text>
            <Text style={styles.savedValue}>{anchorData.accuracy.toFixed(1)}m</Text>
          </View>
          <View style={styles.savedRow}>
            <Text style={styles.savedLabel}>Wi-Fi BSSID</Text>
            <Text style={[styles.savedValue, { color: anchorData.wifiConnected ? '#2e7d32' : '#e65100' }]}>
              {anchorData.wifiConnected ? anchorData.wifiBssid : 'Not captured'}
            </Text>
          </View>
        </View>
      )}

      {/* ─── Anchor Button ─── */}
      <TouchableOpacity 
        style={[styles.button, isAnchoring && styles.buttonDisabled]} 
        onPress={performAnchoring}
        disabled={isAnchoring}
      >
        {isAnchoring ? (
          <View style={styles.processingRow}>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.buttonText, { marginLeft: 10 }]}>Capturing signals...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>
            {anchorData ? '🔄 Re-Anchor Location' : '📍 Drop Anchor Pin'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footerNote}>
        You only need to anchor once per classroom. The background engine will use these coordinates automatically for every future class.
      </Text>
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
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
    color: '#1a1a2e',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  // ─── Target ───
  targetCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#4a6cf7',
    shadowColor: '#4a6cf7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  targetLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  targetName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4a6cf7',
  },

  // ─── Network ───
  networkCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  networkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  networkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  networkLabel: {
    fontSize: 13,
    color: '#888',
  },
  networkValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  networkWarning: {
    fontSize: 12,
    color: '#e65100',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // ─── Steps ───
  stepsCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3e8ff',
    color: '#7b1fa2',
    textAlign: 'center',
    lineHeight: 32,
    fontSize: 14,
    fontWeight: '800',
    marginRight: 12,
    overflow: 'hidden',
  },
  stepTextBox: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  stepDesc: {
    fontSize: 12,
    color: '#888',
  },

  // ─── Saved Anchor ───
  savedCard: {
    backgroundColor: '#e8f5e9',
    padding: 18,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  savedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 12,
  },
  savedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  savedLabel: {
    fontSize: 13,
    color: '#555',
  },
  savedValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },

  // ─── Button ───
  button: {
    backgroundColor: '#4a6cf7',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#4a6cf7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#a0b4f7',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
