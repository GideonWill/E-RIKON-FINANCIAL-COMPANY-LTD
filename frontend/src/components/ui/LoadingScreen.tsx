import React from 'react';
import logoImg from '../../assets/logo.jpeg';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Authenticating Workstation Clearance...',
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans select-none">
      
      <div className="flex flex-col items-center text-center space-y-8 max-w-sm w-full">
        
        {/* Simple & Classy Logo */}
        <div className="relative">
          <img 
            src={logoImg} 
            alt="E-RIKON GROUP FINANCIAL COMPANY LTD" 
            className="h-20 w-auto object-contain animate-pulse"
          />
        </div>

        {/* Minimal Classy Progress Line & Message */}
        <div className="w-full space-y-4">
          <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-amber-400 rounded-full animate-[loading_5s_linear_infinite] w-full origin-left"></div>
          </div>

          <p className="text-xs font-mono font-medium text-slate-400 tracking-wider">
            {message}
          </p>
        </div>

      </div>

    </div>
  );
};
