import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleName, ApprovalRequest } from '../types';
import { 
  registerNewUserRole, 
  getRegisteredUsers, 
  RegisteredUserRecord,
  apiClient,
  MOCK_BRANCHES 
} from '../services/api';
import { initCloudSync, pushLocalToCloud } from '../services/cloudSync';
import { connectSSE, disconnectSSE, useRealtimeSync } from '../services/realtimeSync';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email?: string, password?: string, role?: RoleName) => Promise<{ success: boolean; error?: string }>;
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
  }) => Promise<{ user: User; approval: ApprovalRequest; isApproved: boolean }>;
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

  // Real-time listener: when Super Admin approves this account, unlock immediately
  useRealtimeSync((payload) => {
    if (payload.type === 'APPROVAL_DECISION_MADE' && currentUser) {
      if (payload.data?.userId === currentUser.id) {
        if (payload.data?.action === 'APPROVED') {
          const updated: User = {
            ...currentUser,
            isApproved: true,
            status: 'ACTIVE',
          };
          setCurrentUser(updated);
          localStorage.setItem('erikon_current_user', JSON.stringify(updated));
        } else if (payload.data?.action === 'REJECTED') {
          logout();
          alert('Your registration was declined by the Super Admin.');
        }
      }
    }
  });

  // Launch background cloud sync
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

  const login = async (email?: string, password?: string, role?: RoleName): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPass = password?.trim();

    if (!cleanEmail || !cleanPass) {
      return { success: false, error: 'Please enter both email and password.' };
    }

    // 1. Authenticate against Live/Local API Backend
    try {
      const { data } = await apiClient.post('/auth/login', {
        email: cleanEmail,
        password: cleanPass,
      });

      if (data && data.user) {
        if (data.accessToken) {
          localStorage.setItem('erikon_access_token', data.accessToken);
          connectSSE(data.accessToken);
        }

        const isUserApproved = data.user.isApproved ?? (data.user.role === 'SUPER_ADMIN');

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
          isApproved: isUserApproved,
          createdAt: new Date().toISOString(),
          status: isUserApproved ? 'ACTIVE' : 'PENDING_APPROVAL',
        };

        setCurrentUser(backendUser);
        localStorage.setItem('erikon_current_user', JSON.stringify(backendUser));
        return { success: true };
      }
    } catch (apiErr: any) {
      console.warn('Backend login notice:', apiErr?.response?.data?.message || apiErr?.message);
      const serverMsg = apiErr?.response?.data?.message;
      if (typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('password')) {
        return { success: false, error: serverMsg };
      }
    }

    // 2. Validate against Locally Registered Accounts (only actual created accounts)
    const localUsers = getRegisteredUsers();
    const match = localUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (match) {
      if (match.password && match.password !== cleanPass) {
        return { success: false, error: 'Incorrect password for this account. Please verify and try again.' };
      }

      setCurrentUser(match);
      localStorage.setItem('erikon_current_user', JSON.stringify(match));
      return { success: true };
    }

    // 3. No account found in system: Reject login
    return { 
      success: false, 
      error: 'No registered account found with these credentials. Please click "sign up" to create your account first.' 
    };
  };

  const loginAsRole = (role: RoleName) => {
    const registered = getRegisteredUsers();
    const registeredMatch = registered.find((u) => u.role === role);
    if (registeredMatch) {
      setCurrentUser(registeredMatch);
      localStorage.setItem('erikon_current_user', JSON.stringify(registeredMatch));
    }
  };

  const signupRole = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: RoleName;
    ghanaCard: string;
    employeeId?: string;
    password?: string;
  }) => {
    const res = await registerNewUserRole(data);
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
