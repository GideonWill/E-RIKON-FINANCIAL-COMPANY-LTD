import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleName, ApprovalRequest } from '../types';
import { 
  MOCK_USERS, 
  registerNewUserRole, 
  getRegisteredUsers, 
  saveRegisteredUsers,
  RegisteredUserRecord,
  apiClient,
  MOCK_BRANCHES 
} from '../services/api';
import { initCloudSync, pushLocalToCloud, pullCloudToLocal } from '../services/cloudSync';
import { connectSSE, disconnectSSE } from '../services/realtimeSync';

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

  // Reconnect SSE stream on page refresh if user is already logged in
  useEffect(() => {
    const existingToken = localStorage.getItem('erikon_access_token');
    if (existingToken && currentUser) {
      connectSSE(existingToken);
    }
    return () => {
      disconnectSSE();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email?: string, password?: string, _role?: RoleName): Promise<boolean> => {
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPass = password?.trim();

    if (!cleanEmail || !cleanPass) {
      return false;
    }

    // 1. Authenticate against Live Render API Backend
    try {
      const { data } = await apiClient.post('/auth/login', {
        email: cleanEmail,
        password: cleanPass,
      });
      if (data && data.user) {
        if (data.accessToken) {
          localStorage.setItem('erikon_access_token', data.accessToken);
          // Connect SSE stream for real-time cross-device sync
          connectSSE(data.accessToken);
        }
        const backendUser: RegisteredUserRecord = {
          id: data.user.id,
          employeeId: data.user.employeeId || `EMP-${Date.now().toString().slice(-4)}`,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          email: data.user.email,
          phone: data.user.phone || '+233 24 000 0000',
          role: data.user.role,
          password: cleanPass,
          ghanaCard: data.user.ghanaCard || 'GHA-000000000-0',
          branchId: data.user.branchId || 'br-01',
          branch: data.user.branch || MOCK_BRANCHES[0],
          createdAt: new Date().toISOString(),
          status: 'ACTIVE',
        };

        const localUsers = getRegisteredUsers();
        saveRegisteredUsers([
          backendUser,
          ...localUsers.filter((u) => u.email.toLowerCase() !== cleanEmail),
        ]);

        setCurrentUser(backendUser);
        localStorage.setItem('erikon_current_user', JSON.stringify(backendUser));
        pushLocalToCloud().catch(() => {});
        return true;
      }
    } catch (apiErr) {
      console.warn('Live Render backend login unavailable, verifying via cloud relay...', apiErr);
    }

    // 2. Fallback: Check in local registered users & cloud sync relay
    let registered = getRegisteredUsers();
    let match = registered.find((u) => u.email.toLowerCase() === cleanEmail);

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
    // Disconnect SSE stream cleanly
    disconnectSSE();
    setCurrentUser(null);
    localStorage.removeItem('erikon_current_user');
    localStorage.removeItem('erikon_access_token');
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
