import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import logoImg from '../../assets/logo.jpeg';
import { 
  ShieldAlert, 
  Clock, 
  LogOut, 
  RefreshCw, 
  User, 
  Building2, 
  CreditCard, 
  Phone, 
  Mail, 
  CheckCircle2,
  Lock
} from 'lucide-react';
import { apiClient } from '../../services/api';

export const PendingApprovalScreen: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const handleManualCheck = async () => {
    setIsChecking(true);
    setStatusNote(null);
    try {
      const { data } = await apiClient.get('/auth/users');
      if (Array.isArray(data) && currentUser) {
        const found = data.find((u: any) => u.id === currentUser.id || u.email === currentUser.email);
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
      setStatusNote('Account is still pending Super Admin approval. You will gain instant access once approved.');
    } catch {
      setStatusNote('Connecting to authorization server...');
    } finally {
      setIsChecking(false);
      setTimeout(() => setStatusNote(null), 5000);
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans"
      style={{
        paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 1rem), 2.5rem)',
      }}
    >
      {/* Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Bar */}
      <div className="flex items-center justify-between z-10 max-w-4xl w-full mx-auto">
        <div className="flex items-center space-x-3">
          <img 
            src={logoImg} 
            alt="E-RIKON Logo" 
            className="h-10 sm:h-12 w-auto object-contain rounded-lg shrink-0"
          />
          <div>
            <h1 className="font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
              E-RIKON <span className="text-amber-400 font-semibold text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">ECFMS v2.0</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Core Financial Management System
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Center Notice Card */}
      <div className="my-8 z-10 max-w-xl w-full mx-auto">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/95 border border-amber-500/30 shadow-2xl backdrop-blur-xl text-center space-y-6">
          
          {/* Pulsing Shield Icon */}
          <div className="relative inline-flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-20 w-20 rounded-full bg-amber-400/20"></span>
            <div className="p-4 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-xl relative">
              <ShieldAlert className="w-10 h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-400 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>AWAITING SUPER ADMIN APPROVAL</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Account Registration Pending
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Welcome, <strong className="text-white">{currentUser?.firstName} {currentUser?.lastName}</strong>. Your account has been registered in the system, but financial security policies require executive approval by the <strong className="text-amber-400">Super Admin</strong> before workstation access is granted.
            </p>
          </div>

          {/* User Details Box */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>Requested Position:</span>
              </span>
              <span className="font-bold text-white font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                {currentUser?.role?.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>Staff Email:</span>
              </span>
              <span className="font-mono text-slate-300 truncate max-w-[200px]">
                {currentUser?.email}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Phone:</span>
              </span>
              <span className="font-mono text-slate-300">
                {currentUser?.phone}
              </span>
            </div>

            {currentUser?.ghanaCard && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ghana Card PIN:</span>
                </span>
                <span className="font-mono text-cyan-400 font-bold">
                  {currentUser?.ghanaCard}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Assigned Branch:</span>
              </span>
              <span className="font-semibold text-slate-300">
                {currentUser?.branch?.name || 'Accra Central Main Branch'}
              </span>
            </div>
          </div>

          {statusNote && (
            <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold text-center animate-pulse">
              {statusNote}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleManualCheck}
              disabled={isChecking}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking Approval Status...' : 'Check Approval Status'}</span>
            </button>

            <button
              onClick={logout}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            ⚡ This page will automatically unlock in real-time as soon as the Super Admin approves your account on their device.
          </p>

        </div>
      </div>

      {/* Footer */}
      <div className="max-w-4xl w-full mx-auto text-center z-10 text-[11px] text-slate-500 border-t border-slate-900 pt-4">
        © {new Date().getFullYear()} E-RIKON GROUP FINANCIAL COMPANY LTD. All rights reserved.
      </div>
    </div>
  );
};
