import React, { createContext, useContext, useState } from 'react';
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const login = (email?: string, password?: string, role?: RoleName): boolean => {
    const targetRole = role || 'TELLER';
    if (MOCK_USERS[targetRole]) {
      setCurrentUser(MOCK_USERS[targetRole]);
      return true;
    }
    return false;
  };

  const loginAsRole = (role: RoleName) => {
    setCurrentUser(MOCK_USERS[role]);
  };

  const logout = () => {
    setCurrentUser(null);
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
