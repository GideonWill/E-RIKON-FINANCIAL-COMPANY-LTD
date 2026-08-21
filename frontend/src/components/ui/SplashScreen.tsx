import React, { useState, useEffect, useCallback } from 'react';
import logoImg from '../../assets/logo.png';
import { broadcastRealtimeEvent } from '../../services/realtimeSync';

interface SplashScreenProps {
  onFinish?: () => void;
  minDuration?: number; // milliseconds
}

/**
 * Global helper to trigger full programmatic app refresh with splash screen
 */
export const triggerAppRefresh = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_trigger_refresh_splash'));
  }
};

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onFinish, 
  minDuration = 1600 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [progress, setProgress] = useState(15);
  const [statusMessage, setStatusMessage] = useState('Synchronizing core financial ledgers...');

  const runSplashCycle = useCallback((customDuration = minDuration) => {
    setIsVisible(true);
    setIsFading(false);
    setProgress(15);
    setStatusMessage('Synchronizing core financial ledgers...');

    // Trigger background data updates
    broadcastRealtimeEvent('MANUAL_SYNC', null);
    window.dispatchEvent(new CustomEvent('erikon_realtime_update'));
    window.dispatchEvent(new Event('storage'));

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          setStatusMessage('Verified latest system updates.');
          return 100;
        }
        return prev + Math.floor(Math.random() * 25) + 15;
      });
    }, 180);

    const timer = setTimeout(() => {
      setIsFading(true);
      const finishTimer = setTimeout(() => {
        setIsVisible(false);
        if (onFinish) onFinish();
        window.dispatchEvent(new CustomEvent('erikon_splash_completed'));
      }, 400);

      return () => clearTimeout(finishTimer);
    }, customDuration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, [minDuration, onFinish]);

  // Run on initial mount
  useEffect(() => {
    const cleanup = runSplashCycle(minDuration);
    return cleanup;
  }, [runSplashCycle, minDuration]);

  // Listen for manual / programmatic refresh triggers
  useEffect(() => {
    const handleRefreshEvent = () => {
      runSplashCycle(1400);
    };

    window.addEventListener('erikon_trigger_refresh_splash', handleRefreshEvent);
    return () => {
      window.removeEventListener('erikon_trigger_refresh_splash', handleRefreshEvent);
    };
  }, [runSplashCycle]);

  if (!isVisible) return null;

  return (
    <div
      id="erikon-mobile-splash"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 bg-white text-slate-900 select-none transition-all duration-400 ease-out ${
        isFading ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundColor: '#ffffff',
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Center Logo on Pure White Background with no borders */}
      <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-md w-full">
        
        {/* Borderless Logo in the middle */}
        <img
          src={logoImg}
          alt="E-RiKON Financial Company PLC"
          className="w-64 sm:w-76 max-w-[85vw] h-auto object-contain animate-fade-in"
        />

        {/* Minimal Progress Bar & Status Text */}
        <div className="w-52 sm:w-64 space-y-2 pt-2">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0d9488] via-[#10b981] to-[#166534] rounded-full transition-all duration-300 ease-out shadow-sm"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] font-mono text-slate-500 font-semibold tracking-tight">
            {statusMessage}
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
