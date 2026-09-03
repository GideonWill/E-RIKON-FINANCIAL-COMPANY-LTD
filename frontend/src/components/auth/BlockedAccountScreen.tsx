import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import logoImg from '../../assets/logo.png';
import { 
  NoSymbolIcon, 
  ArrowRightOnRectangleIcon, 
  ArrowPathIcon, 
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';
import { getRegisteredUsers, isUserBlocked } from '../../services/api';
import { useRealtimeSync } from '../../services/realtimeSync';
import { pullCloudToLocal } from '../../services/cloudSync';
import { User } from '../../types';

interface BlockedAccountScreenProps {
  user?: User | null;
}

export const BlockedAccountScreen: React.FC<BlockedAccountScreenProps> = ({ user }) => {
  const { currentUser, logout, setCurrentUser } = useAuth();
  const activeUser = user || currentUser;
  const [isChecking, setIsChecking] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const checkUnblockStatus = async (silent = false) => {
    if (!silent) setIsChecking(true);
    try {
      // 1. Pull latest cloud data
      await pullCloudToLocal().catch(() => {});

      // 2. Check local registered users
      const localUsers = getRegisteredUsers();
      if (activeUser) {
        const localMatch = localUsers.find(
          (u) => u.id === activeUser.id || u.email?.toLowerCase() === activeUser.email?.toLowerCase()
        );

        const stillBlocked = isUserBlocked(localMatch || activeUser);

        if (localMatch && !stillBlocked && (localMatch.isApproved || localMatch.role === 'SUPER_ADMIN')) {
          const updated: User = {
            ...localMatch,
            isBlocked: false,
            status: 'ACTIVE',
          };
          localStorage.setItem('erikon_current_user', JSON.stringify(updated));
          setCurrentUser(updated);
          return;
        }
      }

      if (!silent) {
        setStatusNote('Workstation remains suspended. Contact your Super Administrator for access restoration.');
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

  // Continuous auto-poller (every 2.5s) to guarantee instant unlock the instant Super Admin unblocks
  useEffect(() => {
    const timer = setInterval(() => {
      checkUnblockStatus(true);
    }, 2500);
    return () => clearInterval(timer);
  }, [activeUser]);

  // Real-time SSE / BroadcastChannel listener
  useRealtimeSync((payload) => {
    if (payload.type === 'USER_STATUS_CHANGED' || payload.type === 'MANUAL_SYNC') {
      checkUnblockStatus(true);
    }
  });

  const handleManualCheck = () => {
    checkUnblockStatus(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-3 sm:p-5 lg:p-6 select-none overflow-y-auto font-sans relative">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between gap-3 shrink-0 pb-2 border-b border-rose-900/30">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <img 
            src={logoImg} 
            alt="E-RiKON Logo" 
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-md brightness-110" 
          />
          <div>
            <span className="font-extrabold text-xs sm:text-sm tracking-tight text-white block">
              E-RIKON E-CFMS
            </span>
            <span className="text-[9px] sm:text-[10px] text-rose-400 font-bold uppercase tracking-wider block">
              Executive Security & Access Control
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-3 sm:px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 hover:text-rose-300 font-bold text-xs flex items-center space-x-1.5 border border-rose-900/40 transition-all cursor-pointer shadow-sm"
        >
          <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
          <span>Exit Session</span>
        </button>
      </header>

      {/* Center Blocked Hero Card */}
      <main className="relative z-10 w-full max-w-xl mx-auto my-auto py-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 border-rose-600/50 shadow-2xl backdrop-blur-xl space-y-6 text-center">
          
          {/* Animated Ban Icon */}
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-3xl bg-rose-600/20 animate-ping opacity-50" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-700 to-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-900/50 border border-rose-400/40">
              <NoSymbolIcon className="w-10 h-10 stroke-[2.5]" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-black uppercase tracking-wider">
              <ExclamationCircleIcon className="w-3.5 h-3.5" />
              <span>Access Blocked by Super Admin</span>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Workstation Access Suspended
            </h2>
            
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              Your institutional personnel workstation has been temporarily suspended from accessing E-RIKON system portals by the Super Administrator.
            </p>
          </div>

          {/* User Dossier Card */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Personnel:</span>
              <span className="font-bold text-white font-sans">{activeUser?.firstName} {activeUser?.lastName}</span>
            </div>
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Workstation Role:</span>
              <span className="font-black text-amber-400">{activeUser?.role?.replace(/_/g, ' ')}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Ghana Card:</span>
              <span className="text-slate-200">{activeUser?.ghanaCard || 'GHA-XXXXXXXXX-X'}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Employee ID:</span>
              <span className="text-slate-200">{activeUser?.employeeId || 'STAFF'}</span>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <span className="text-slate-400">Suspension Status:</span>
              <span className="font-bold text-rose-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                BLOCKED / LOCKED
              </span>
            </div>

            {activeUser?.blockedReason && (
              <div className="pt-2 border-t border-slate-800 text-[11px] text-amber-300/90 font-sans">
                <b>Suspension Reason:</b> {activeUser.blockedReason}
              </div>
            )}
          </div>

          {/* Real-time sync indicator */}
          <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-900/40 flex items-center justify-between text-left text-[11px]">
            <div className="flex items-center space-x-2">
              <ArrowPathIcon className={`w-4 h-4 text-rose-400 ${isChecking ? 'animate-spin' : ''}`} />
              <span className="text-slate-300">
                {statusNote || 'Real-time security sync listening for Super Admin clearance...'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleManualCheck}
              disabled={isChecking}
              className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-[10px] border border-rose-500/30 transition-all cursor-pointer"
            >
              {isChecking ? 'Checking...' : 'Check Status'}
            </button>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={logout}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-slate-200 font-extrabold text-xs flex items-center justify-center space-x-2 border border-slate-700 transition-all cursor-pointer shadow-lg"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4 text-rose-400" />
              <span>Switch Account or Return to Login</span>
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[10px] text-slate-500 font-mono py-2">
        E-RIKON FINANCIAL COMPANY LTD • Secure Cross-Device Banking Cloud • NIA Verified
      </footer>
    </div>
  );
};
