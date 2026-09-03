import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleHomePath } from '../../types';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

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

    // If dragged right >= 65px with horizontal dominance, navigate back within role workstation!
    if (deltaX >= 65 && deltaX > deltaY * 1.3) {
      const roleHome = getRoleHomePath(currentUser?.role);
      const isAtRoleRoot = 
        location.pathname === roleHome || 
        location.pathname === '/' || 
        location.pathname === '/dashboard';

      // Prevent slide back gesture from leaving the role workstation to the signin page
      if (!isAtRoleRoot) {
        if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
        } else {
          navigate(roleHome);
        }
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

      <div 
        className="flex flex-1 min-h-0 overflow-hidden relative min-w-0"
        style={{
          paddingTop: 'calc(var(--header-height, 3.75rem) + 1.25rem)',
        }}
      >
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main 
          className="flex-1 px-3.5 pt-3 pb-8 sm:px-6 sm:pt-4 sm:pb-10 md:px-8 md:pt-6 md:pb-12 overflow-y-auto max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden overscroll-contain"
          style={{ 
            WebkitOverflowScrolling: 'touch', 
            touchAction: 'pan-y',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 2rem)',
            scrollPaddingTop: 'calc(var(--header-height, 3.75rem) + 1.25rem)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
