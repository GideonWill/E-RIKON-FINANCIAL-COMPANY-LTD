import React, { useState, useRef } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Touch Swipe Gesture Detection for Mobile Devices
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Ensure swipe is primarily horizontal
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaY) < 70) {
      // Swipe Right (finger moving left-to-right from edge < 80px) -> Open Drawer
      if (deltaX > 40 && touchStartRef.current.x < 80 && !isMobileMenuOpen) {
        setIsMobileMenuOpen(true);
      }
      // Swipe Left (finger moving right-to-left) -> Close Drawer
      else if (deltaX < -40 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    }

    touchStartRef.current = null;
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden"
    >
      <Header onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)} />
      <div className="flex flex-1 relative min-w-0">
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
