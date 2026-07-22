import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RoleName } from '../../types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: RoleName[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { currentUser, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Access Denied (Unauthorized Workstation)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your current role (<span className="font-bold text-amber-500">{currentUser.role.replace('_', ' ')}</span>) does not have permission to view this module.
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs flex items-center space-x-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Role Login Portal</span>
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
