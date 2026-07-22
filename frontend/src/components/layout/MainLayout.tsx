import React, { useState, useRef } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { broadcastRealtimeEvent } from '../../services/realtimeSync';
import { RefreshCw } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Touch Gesture Detection for Mobile Devices (Horizontal Drawer & Vertical Drag-Down Refresh)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !mainRef.current) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaX = touch.clientX - touchStartRef.current.x;

    // Check if dragging down at top of page (Pull-to-Refresh)
    const isAtTop = mainRef.current.scrollTop <= 0;
    if (isAtTop && deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX) && !isMobileMenuOpen) {
      const distance = Math.min(100, Math.max(0, deltaY * 0.5));
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // 1. Horizontal Drawer Swipe Detection
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaY) < 70) {
      // Swipe Right from left edge -> Open Drawer
      if (deltaX > 40 && touchStartRef.current.x < 80 && !isMobileMenuOpen) {
        setIsMobileMenuOpen(true);
      }
      // Swipe Left -> Close Drawer
      else if (deltaX < -40 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    }

    // 2. Drag-Down Refresh Trigger (Threshold = 60px)
    if (pullDistance > 60 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(70);

      // Trigger soft data sync & page refresh
      broadcastRealtimeEvent('MANUAL_SYNC', null);
      window.dispatchEvent(new CustomEvent('erikon_realtime_update'));

      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 1200);
    } else {
      setPullDistance(0);
    }

    touchStartRef.current = null;
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden"
    >
      <Header onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)} />

      {/* Mobile Drag-Down Pull-to-Refresh Visual Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 pointer-events-none flex items-center justify-center"
          style={{ transform: `translate(-50%, ${pullDistance}px)` }}
        >
          <div className="bg-slate-900 text-amber-400 border border-slate-800 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold font-mono">
            <RefreshCw className={`w-4 h-4 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing Workstation...' : pullDistance > 60 ? 'Release to Refresh' : 'Pull down to refresh'}</span>
          </div>
        </div>
      )}

      <div className="flex flex-1 relative min-w-0">
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main 
          ref={mainRef}
          className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
