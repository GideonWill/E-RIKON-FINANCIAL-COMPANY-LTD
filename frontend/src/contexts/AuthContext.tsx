import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleName, ApprovalRequest } from '../types';
import { MOCK_USERS, registerNewUserRole, getRegisteredUsers, RegisteredUserRecord } from '../services/api';
import { initCloudSync, pushLocalToCloud, pullCloudToLocal } from '../services/cloudSync';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email?: string, password?: string, role?: RoleName) => Promise<boolean>;
  loginAsRole: (role: RoleName) => void;
  signupRole: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: RoleName;
    ghanaCard: string;
    employeeId?: string;
    password?: string;
  }) => { user: User; approval: ApprovalRequest };
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
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('erikon_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('erikon_current_user');
    }
  }, [currentUser]);

  // Launch background cloud sync to keep laptop and phone aligned in real-time
  useEffect(() => {
    const cleanup = initCloudSync();
    return () => cleanup();
  }, []);

  const login = async (email?: string, password?: string, _role?: RoleName): Promise<boolean> => {
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPass = password?.trim();

    if (!cleanEmail || !cleanPass) {
      return false;
    }

    // 1. Check in local registered users
    let registered = getRegisteredUsers();
    let match = registered.find((u) => u.email.toLowerCase() === cleanEmail);

    // 2. If not found locally, immediately fetch from cloud relay
    if (!match) {
      await pullCloudToLocal().catch(() => {});
      registered = getRegisteredUsers();
      match = registered.find((u) => u.email.toLowerCase() === cleanEmail);
    }

    if (match) {
      if (!match.password || match.password === cleanPass) {
        setCurrentUser(match);
        localStorage.setItem('erikon_current_user', JSON.stringify(match));
        return true;
      }
    }

    return false;
  };

  const loginAsRole = (role: RoleName) => {
    const registered = getRegisteredUsers();
    const registeredMatch = registered.find((u) => u.role === role);
    if (registeredMatch) {
      setCurrentUser(registeredMatch);
      localStorage.setItem('erikon_current_user', JSON.stringify(registeredMatch));
    }
  };

  const signupRole = (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: RoleName;
    ghanaCard: string;
    employeeId?: string;
    password?: string;
  }) => {
    const res = registerNewUserRole(data);
    pushLocalToCloud().catch(() => {});
    return res;
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
        signupRole,
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
