import React, { useState, useEffect } from 'react';
import logoImg from '../../assets/logo.png';

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
      }, 500);

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
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 bg-white text-slate-900 select-none transition-all duration-500 ease-out ${
        isFading ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundColor: '#ffffff',
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Center Logo on Pure White Background with no borders */}
      <div className="flex flex-col items-center justify-center text-center space-y-5 max-w-md w-full">
        
        {/* Borderless Logo in the middle */}
        <img
          src={logoImg}
          alt="E-RiKON Financial Company PLC"
          className="w-60 sm:w-72 max-w-[85vw] h-auto object-contain"
        />

        {/* Minimal Progress Bar */}
        <div className="w-48 sm:w-60 space-y-2 pt-2">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0d9488] via-[#10b981] to-[#166534] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] font-mono text-slate-400 font-medium">
            Core Financial Management System • ECFMS v2.0
          </p>
        </div>

      </div>

      {/* Bottom Copyright */}
      <div className="absolute bottom-6 text-center text-[10px] text-slate-400 font-medium font-mono">
        © {new Date().getFullYear()} E-RiKON Financial Company PLC • All Rights Reserved
      </div>
    </div>
  );
};
