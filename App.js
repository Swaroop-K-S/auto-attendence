import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthProvider, useAuth } from './AuthContext';

// Screens
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import TimetableScreen from './screens/TimetableScreen';
import UploadTimetableScreen from './screens/UploadTimetableScreen';
import AnchorClassScreen from './screens/AnchorClassScreen';
import ManualEntryScreen from './screens/ManualEntryScreen';
import ProfileScreen from './screens/ProfileScreen';
import CalendarScreen from './screens/CalendarScreen';

import { initDB } from './database';
import { registerBackgroundValidationTask } from './backgroundEngine';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

/**
 * Nested Stack Navigator for screens that should NOT appear in the drawer
 * (e.g. Anchor, ManualEntry) but are navigated to from within drawer screens.
 */
function TimetableStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TimetableMain" component={TimetableScreen} />
      <Stack.Screen name="Anchor" component={AnchorClassScreen} options={{ headerShown: true, title: 'Anchor Class Location' }} />
    </Stack.Navigator>
  );
}

function UploadStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UploadMain" component={UploadTimetableScreen} />
      <Stack.Screen name="ManualEntry" component={ManualEntryScreen} options={{ headerShown: true, title: 'Add Class' }} />
    </Stack.Navigator>
  );
}

/**
 * Main Drawer Navigator — visible only when authenticated.
 */
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        drawerActiveTintColor: '#007AFF',
        drawerInactiveTintColor: '#555',
        drawerLabelStyle: { fontSize: 15, fontWeight: '500' },
        drawerStyle: { backgroundColor: '#f9f9f9', width: 280 },
        headerStyle: { backgroundColor: '#fff', elevation: 2 },
        headerTintColor: '#333',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Drawer.Screen 
        name="Dashboard" 
        component={HomeScreen} 
        options={{ 
          title: '📊 Dashboard',
          headerTitle: 'Smart Attendance',
        }} 
      />
      <Drawer.Screen 
        name="Timetable" 
        component={TimetableStack} 
        options={{ 
          title: '📅 My Timetable',
          headerTitle: 'My Schedule',
        }} 
      />
      <Drawer.Screen 
        name="Calendar" 
        component={CalendarScreen} 
        options={{ 
          title: '🗓️ College Calendar',
          headerTitle: 'Academic Events',
        }} 
      />
      <Drawer.Screen 
        name="Upload" 
        component={UploadStack} 
        options={{ 
          title: '➕ Add Schedule',
          headerTitle: 'Upload Schedule',
        }} 
      />
      <Drawer.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ 
          title: '👤 Profile & Settings',
          headerTitle: 'Profile',
        }} 
      />
    </Drawer.Navigator>
  );
}

/**
 * Root component that decides between Login and Main app based on auth state.
 */
function AppRoot() {
  const { user } = useAuth();

  useEffect(() => {
    // Initialize DB and background engine on app start
    initDB();
    registerBackgroundValidationTask();
  }, []);

  return (
    <NavigationContainer>
      {user ? <DrawerNavigator /> : <LoginScreen />}
    </NavigationContainer>
  );
}

/**
 * Top-level App wrapped with AuthProvider.
 */
export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
