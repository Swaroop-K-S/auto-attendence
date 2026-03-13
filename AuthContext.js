import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

/**
 * AuthProvider wraps the app and provides user state + login/logout methods.
 * Uses AsyncStorage to persist session data holding User Name, SRN, and Branch.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user on startup
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@user_session');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Failed to load user session", e);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (name, srn, branch) => {
    const newUser = {
      id: 'local_' + Date.now(),
      name: name || 'Student',
      srn: srn || '',
      branch: branch || '',
      loggedInAt: new Date().toISOString(),
    };
    try {
      await AsyncStorage.setItem('@user_session', JSON.stringify(newUser));
      setUser(newUser);
    } catch (e) {
      console.error("Failed to save user session", e);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('@user_session');
      setUser(null);
    } catch (e) {
      console.error("Failed to logout", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access user state and auth functions from any component.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
