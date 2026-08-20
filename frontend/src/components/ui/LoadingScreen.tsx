import React from 'react';
import logoImg from '../../assets/logo.png';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Authenticating Workstation Clearance...',
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a]/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white font-sans select-none">
      
      <div className="flex flex-col items-center text-center space-y-6 max-w-sm w-full bg-white text-slate-900 p-8 rounded-[32px] shadow-2xl">
        
        {/* Simple & Classy Borderless Logo */}
        <img 
          src={logoImg} 
          alt="E-RiKON Financial Company PLC" 
          className="h-16 sm:h-20 w-auto object-contain"
        />

        {/* Minimal Classy Progress Line & Message */}
        <div className="w-full space-y-3">
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#0d9488] to-[#166534] rounded-full animate-[loading_2s_linear_infinite] w-full origin-left"></div>
          </div>

          <p className="text-xs font-bold text-slate-600 tracking-wide">
            {message}
          </p>
        </div>

      </div>

    </div>
  );
};
