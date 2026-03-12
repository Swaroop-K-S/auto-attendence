import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

/**
 * AuthProvider wraps the app and provides user state + login/logout methods.
 * Uses local state (no cloud auth). User data persists only during the session.
 * Can be extended to use AsyncStorage or a backend in the future.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (name, email) => {
    setUser({
      id: 'local_' + Date.now(),
      name: name || 'Student',
      email: email || '',
      loggedInAt: new Date().toISOString(),
    });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access user state and auth functions from any component.
 * Usage: const { user, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
