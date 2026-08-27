import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleName, ApprovalRequest } from '../types';
import { 
  registerNewUserRole, 
  getRegisteredUsers, 
  RegisteredUserRecord,
  apiClient
} from '../services/api';
import { initCloudSync, pushLocalToCloud } from '../services/cloudSync';
import { connectSSE, disconnectSSE, useRealtimeSync } from '../services/realtimeSync';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
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

  // Real-time listener: when Super Admin approves this account on laptop, unlock immediately
  useRealtimeSync((payload) => {
    if (!currentUser) return;

    // 1. Direct SSE payload: { userId, action, role }
    if (payload.type === 'APPROVAL_DECISION_MADE') {
      if (payload.data?.userId === currentUser.id || payload.data?.name?.toLowerCase() === `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase()) {
        if (payload.data?.action === 'APPROVED') {
          const updated: User = {
            ...currentUser,
            isApproved: true,
            status: 'ACTIVE',
          };
          setCurrentUser(updated);
          localStorage.setItem('erikon_current_user', JSON.stringify(updated));
          return;
        } else if (payload.data?.action === 'REJECTED') {
          logout();
          alert('Your registration was declined by the Super Admin.');
          return;
        }
      }

      // If payload data is an array of approvals
      if (Array.isArray(payload.data)) {
        const matchingAppr = payload.data.find(
          (a) => (a.targetId === currentUser.id || a.details?.email?.toLowerCase() === currentUser.email?.toLowerCase())
        );
        if (matchingAppr) {
          if (matchingAppr.status === 'APPROVED' && !currentUser.isApproved) {
            const updated: User = {
              ...currentUser,
              isApproved: true,
              status: 'ACTIVE',
            };
            setCurrentUser(updated);
            localStorage.setItem('erikon_current_user', JSON.stringify(updated));
            return;
          } else if (matchingAppr.status === 'REJECTED') {
            logout();
            alert('Your registration was declined by the Super Admin.');
            return;
          }
        }
      }
    }

    // 2. Check registered users list on sync
    if (payload.type === 'STAFF_REGISTERED' || payload.type === 'MANUAL_SYNC' || payload.type === 'APPROVAL_DECISION_MADE') {
      const allUsers = getRegisteredUsers();
      const myRecord = allUsers.find((u) => u.id === currentUser.id || u.email?.toLowerCase() === currentUser.email?.toLowerCase());
      if (myRecord && myRecord.isApproved && !currentUser.isApproved) {
        const updated: User = {
          ...currentUser,
          isApproved: true,
          status: 'ACTIVE',
        };
        setCurrentUser(updated);
        localStorage.setItem('erikon_current_user', JSON.stringify(updated));
      }
    }
  });

  // Launch background cloud sync & SSE stream
  useEffect(() => {
    const cleanup = initCloudSync();
    connectSSE();
    return () => {
      cleanup();
      disconnectSSE();
    };
  }, []);

  const formatRoleLabel = (r?: string) => {
    if (!r) return 'Assigned Role';
    return r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

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
        role,
      });

      if (data && data.user) {
        // Enforce role check: User must be in the selected role
        if (role && data.user.role !== role) {
          return {
            success: false,
            error: `Access Denied: This account is registered as "${formatRoleLabel(data.user.role)}", not "${formatRoleLabel(role)}". Please switch to the ${formatRoleLabel(data.user.role)} role tab to sign in.`,
          };
        }

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
      if (typeof serverMsg === 'string' && (serverMsg.toLowerCase().includes('password') || serverMsg.toLowerCase().includes('role') || serverMsg.toLowerCase().includes('denied'))) {
        return { success: false, error: serverMsg };
      }
    }

    // 2. Validate against Locally Registered Accounts (only actual created accounts)
    const localUsers = getRegisteredUsers();
    const match = localUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (match) {
      // Enforce role check: User must be in the selected role
      if (role && match.role !== role) {
        return {
          success: false,
          error: `Access Denied: This account is registered as "${formatRoleLabel(match.role)}", not "${formatRoleLabel(role)}". Please switch to the ${formatRoleLabel(match.role)} role tab to sign in.`,
        };
      }

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
      error: `No registered account found for "${cleanEmail}". Please click "Sign Up" to register first.` 
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
        setCurrentUser,
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
