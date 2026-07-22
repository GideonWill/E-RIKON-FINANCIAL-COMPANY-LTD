import React from 'react';
import logoImg from '../../assets/logo.jpeg';
import { ShieldCheck, Building2, Lock } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Authenticating Staff Workstation Clearance...',
  subMessage = 'E-RIKON GROUP FINANCIAL COMPANY LTD • Securing Connection',
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white font-sans">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-md w-full">
        
        {/* Animated Company Logo */}
        <div className="relative group">
          <div className="absolute -inset-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl blur-xl opacity-50 animate-pulse"></div>
          <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center">
            <img 
              src={logoImg} 
              alt="E-RIKON GROUP FINANCIAL COMPANY LTD" 
              className="h-24 w-auto object-contain animate-pulse"
            />
          </div>
        </div>

        {/* Brand & System Title */}
        <div className="space-y-1">
          <h2 className="font-extrabold text-2xl tracking-tight text-white flex items-center justify-center gap-2">
            E-RIKON <span className="text-amber-400 font-semibold text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">ECFMS v1.0</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {subMessage}
          </p>
        </div>

        {/* Loading Progress Bar */}
        <div className="w-full space-y-2 pt-2">
          <div className="w-full bg-slate-900 rounded-full h-2 border border-slate-800 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full animate-[loading_1.5s_ease-in-out_infinite] w-full origin-left"></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> {message}
            </span>
            <span className="animate-pulse">Loading...</span>
          </div>
        </div>

        {/* Security Compliance Badge */}
        <div className="pt-4 text-[10px] text-slate-500 font-mono border-t border-slate-900 w-full flex items-center justify-center gap-2">
          <Lock className="w-3 h-3 text-slate-500" />
          <span>Strict RBAC Encrypted Session Transfer</span>
        </div>

      </div>

    </div>
  );
};
