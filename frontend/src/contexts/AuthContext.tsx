import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleName } from '../types';
import { MOCK_USERS } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email?: string, password?: string, role?: RoleName) => boolean;
  loginAsRole: (role: RoleName) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('erikon_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return MOCK_USERS['SUPER_ADMIN'];
      }
    }
    // Default initial session for workstation access
    return MOCK_USERS['SUPER_ADMIN'];
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('erikon_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('erikon_current_user');
    }
  }, [currentUser]);

  const login = (email?: string, password?: string, role?: RoleName): boolean => {
    const targetRole = role || 'SUPER_ADMIN';
    if (MOCK_USERS[targetRole]) {
      const user = MOCK_USERS[targetRole];
      setCurrentUser(user);
      localStorage.setItem('erikon_current_user', JSON.stringify(user));
      return true;
    }
    return false;
  };

  const loginAsRole = (role: RoleName) => {
    const user = MOCK_USERS[role];
    setCurrentUser(user);
    localStorage.setItem('erikon_current_user', JSON.stringify(user));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('erikon_current_user');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        login,
        loginAsRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
