import * as React from 'react';
import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import TimetableScreen from './screens/TimetableScreen';
import UploadTimetableScreen from './screens/UploadTimetableScreen';
import AnchorClassScreen from './screens/AnchorClassScreen';

import { initDB } from './database';
import { registerBackgroundValidationTask } from './backgroundEngine';

const Stack = createNativeStackNavigator();

export default function App() {
  
  useEffect(() => {
    // 1. Initialize our local SQLite Tables
    initDB();
    
    // 2. Boot up the Background Geofencing listener
    registerBackgroundValidationTask();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Smart Attendance' }} />
        <Stack.Screen name="Timetable" component={TimetableScreen} options={{ title: 'My Schedule' }} />
        <Stack.Screen name="Upload" component={UploadTimetableScreen} options={{ title: 'Upload Schedule' }} />
        <Stack.Screen name="Anchor" component={AnchorClassScreen} options={{ title: 'Anchor Class Location' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
