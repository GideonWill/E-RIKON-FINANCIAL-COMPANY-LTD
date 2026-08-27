import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import logoImg from '../../assets/logo.png';
import { 
  ShieldAlert, 
  LogOut, 
  RefreshCw, 
  CheckCircle2,
  Lock,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { apiClient, getRegisteredUsers } from '../../services/api';
import { useRealtimeSync } from '../../services/realtimeSync';
import { pullCloudToLocal } from '../../services/cloudSync';

export const PendingApprovalScreen: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const checkApprovalStatus = async (silent = false) => {
    if (!silent) setIsChecking(true);
    try {
      // 1. Pull latest cloud data
      await pullCloudToLocal().catch(() => {});

      // 2. Check local registered users first
      const localUsers = getRegisteredUsers();
      if (currentUser) {
        const localMatch = localUsers.find(
          (u) => u.id === currentUser.id || u.email?.toLowerCase() === currentUser.email?.toLowerCase()
        );
        if (localMatch && (localMatch.isApproved || localMatch.role === 'SUPER_ADMIN')) {
          const updated = {
            ...currentUser,
            isApproved: true,
            status: 'ACTIVE' as const,
          };
          localStorage.setItem('erikon_current_user', JSON.stringify(updated));
          window.location.reload();
          return;
        }
      }

      // 3. Check Live Backend API
      const { data } = await apiClient.get('/auth/users');
      if (Array.isArray(data) && currentUser) {
        const found = data.find((u: any) => u.id === currentUser.id || u.email?.toLowerCase() === currentUser.email?.toLowerCase());
        if (found && (found.isApproved || found.role === 'SUPER_ADMIN')) {
          const updated = {
            ...currentUser,
            isApproved: true,
            status: 'ACTIVE' as const,
          };
          localStorage.setItem('erikon_current_user', JSON.stringify(updated));
          window.location.reload();
          return;
        }
      }
      if (!silent) {
        setStatusNote('Account is still awaiting Super Admin approval. You will gain instant access once approved.');
      }
    } catch {
      if (!silent) setStatusNote('Connecting to authorization server...');
    } finally {
      if (!silent) {
        setIsChecking(false);
        setTimeout(() => setStatusNote(null), 5000);
      }
    }
  };

  // Continuous auto-poller (every 2.5s) to guarantee instant entry when approved on laptop
  useEffect(() => {
    const timer = setInterval(() => {
      checkApprovalStatus(true);
    }, 2500);
    return () => clearInterval(timer);
  }, [currentUser]);

  // Real-time SSE / BroadcastChannel listener
  useRealtimeSync(() => {
    checkApprovalStatus(true);
  });

  const handleManualCheck = () => {
    checkApprovalStatus(false);
  };

  return (
    <div 
      className="min-h-screen bg-[#f8fafc] flex flex-col justify-between p-3 sm:p-5 lg:p-6 select-none overflow-y-auto lg:overflow-hidden font-sans"
    >
      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between gap-3 shrink-0 pb-2">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <img 
            src={logoImg} 
            alt="E-RiKON Logo" 
            className="h-8 sm:h-10 md:h-12 w-auto object-contain shrink-0"
          />
          <span className="hidden sm:inline-flex text-[9px] sm:text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-teal-50 text-[#0d9488] border border-teal-200 shrink-0">
            ECFMS v2.0
          </span>
        </div>

        <button
          onClick={logout}
          className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 shadow-2xs shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Notice Card */}
      <main className="relative z-10 w-full max-w-lg mx-auto my-auto py-4">
        <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl shadow-slate-900/10 border border-slate-100 text-center space-y-5">
          
          {/* Animated Icon Emblem in Logo Teal & Emerald */}
          <div className="relative inline-flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-teal-400/20"></span>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0d9488] to-[#166534] text-white flex items-center justify-center shadow-lg shadow-teal-900/20 relative">
              <Lock className="w-8 h-8" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-50 text-[#065f46] border border-teal-200">
              Clearance Pending
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Registration Submitted!
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Welcome, <strong className="text-slate-900 font-bold">{currentUser?.firstName} {currentUser?.lastName}</strong>. Your account with role <span className="font-mono text-[11px] font-bold text-[#065f46] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 uppercase">{currentUser?.role}</span> has been recorded.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-700">
            <div className="flex items-center space-x-2 text-[#065f46] font-black">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Super Administrator Clearance Required</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              For regulatory auditing and financial safety, all newly registered staff require executive clearance by the <strong>Super Admin</strong> before accessing workstation tools.
            </p>
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Organization: E-RiKON Financial</span>
              <span>Ref: #{currentUser?.id?.slice(0, 8) || 'STAFF'}</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="space-y-3 pt-1">
            <button
              onClick={handleManualCheck}
              disabled={isChecking}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#0d9488] via-[#059669] to-[#166534] hover:from-[#0f766e] hover:to-[#14532d] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-lg shadow-teal-900/20 cursor-pointer disabled:opacity-50 transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking Clearance...' : 'Check Approval Status Now'}</span>
            </button>

            {statusNote && (
              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-950 flex items-center justify-center space-x-2 animate-fade-in font-medium">
                <span>{statusNote}</span>
              </div>
            )}

            <p className="text-[10px] text-slate-400 font-mono">
              ⚡ Real-time authorization active • Unlocks automatically on approval.
            </p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-4xl mx-auto text-center shrink-0 pt-2 text-[11px] text-slate-500 font-mono">
        © {new Date().getFullYear()} E-RiKON Financial Company PLC. All rights reserved.
      </footer>
    </div>
  );
};
