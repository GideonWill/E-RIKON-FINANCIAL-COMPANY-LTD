import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const edgeTouchRef = useRef<{ startX: number; startY: number; isEdge: boolean }>({
    startX: 0,
    startY: 0,
    isEdge: false,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 1024) return;
    const touch = e.touches[0];
    // Detect swipe from left edge zone (within 45px of left screen wall)
    if (touch.clientX <= 45) {
      edgeTouchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        isEdge: true,
      };
    } else {
      edgeTouchRef.current.isEdge = false;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!edgeTouchRef.current.isEdge || window.innerWidth >= 1024) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - edgeTouchRef.current.startX;
    const deltaY = Math.abs(touch.clientY - edgeTouchRef.current.startY);

    // If dragged right >= 65px with horizontal dominance, navigate back!
    if (deltaX >= 65 && deltaX > deltaY * 1.3) {
      if (location.pathname !== '/' && location.pathname !== '/dashboard') {
        navigate(-1);
      }
    }
    edgeTouchRef.current.isEdge = false;
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-200 overflow-hidden relative"
    >
      <Header onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)} />

      <div className="flex flex-1 pt-14 sm:pt-16 min-h-0 overflow-hidden relative min-w-0">
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main 
          className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
