import React, { useState, useRef } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

const DRAWER_WIDTH = 280; // px
const EDGE_DRAG_ZONE = 36; // px from left screen wall

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-200 overflow-hidden relative">
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
