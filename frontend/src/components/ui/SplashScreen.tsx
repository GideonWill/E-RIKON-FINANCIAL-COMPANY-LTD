import React, { useState, useEffect } from 'react';
import logoImg from '../../assets/logo.jpeg';

interface SplashScreenProps {
  onFinish?: () => void;
  minDuration?: number; // milliseconds
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onFinish, 
  minDuration = 1800 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    // Progressive loading indicator animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.floor(Math.random() * 20) + 10;
      });
    }, 200);

    // Fade out after minDuration
    const timer = setTimeout(() => {
      setIsFading(true);
      const finishTimer = setTimeout(() => {
        setIsVisible(false);
        if (onFinish) onFinish();
      }, 600); // match transition duration

      return () => clearTimeout(finishTimer);
    }, minDuration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, [minDuration, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      id="erikon-mobile-splash"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-between p-6 sm:p-8 bg-white text-slate-900 select-none transition-all duration-700 ease-out ${
        isFading ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundColor: '#ffffff',
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Top Brand Tag */}
      <div className="w-full flex items-center justify-between pt-2">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span className="text-[10px] font-mono font-extrabold tracking-widest text-slate-400 uppercase">
            SECURE ACCESS
          </span>
        </div>
        <span className="text-[10px] font-mono font-bold text-slate-400">ECFMS v2.4</span>
      </div>

      {/* Center Logo & Branding */}
      <div className="flex flex-col items-center justify-center text-center space-y-5 my-auto">
        <div className="relative">
          {/* Subtle glowing ring behind logo */}
          <div className="absolute -inset-3 bg-gradient-to-r from-amber-400/20 to-emerald-400/20 rounded-3xl blur-md animate-pulse"></div>
          
          <div className="relative p-3 sm:p-4 rounded-2xl bg-white shadow-xl shadow-slate-200/80 border border-slate-100">
            <img
              src={logoImg}
              alt="E-RiKON Financial Company PLC"
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-xl drop-shadow-sm transform hover:scale-105 transition-transform"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
            E-RiKON <span className="text-amber-500">Financial Company PLC</span>
          </h1>
          <div className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-500 font-mono text-[10px] font-bold mt-1">
            Core Financial Management System
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-48 sm:w-56 space-y-2 pt-3">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] font-mono text-slate-400 font-medium">
            Initializing workstation modules...
          </p>
        </div>
      </div>

      {/* Bottom Regulatory & Security Footer */}
      <div className="w-full text-center pb-2 space-y-1">
        <p className="text-[10px] font-semibold text-slate-400">
          Encrypted 256-bit Financial Ledger
        </p>
        <p className="text-[9px] font-mono text-slate-300 uppercase tracking-wider">
          © 2026 E-RiKON Financial Company PLC • All Rights Reserved
        </p>
      </div>
    </div>
  );
};
