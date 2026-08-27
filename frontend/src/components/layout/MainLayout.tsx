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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);

  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    isEdgeDrag: boolean;
    isOpenDrag: boolean;
    isTracking: boolean;
  }>({
    startX: 0,
    startY: 0,
    isEdgeDrag: false,
    isOpenDrag: false,
    isTracking: false,
  });

  // Mobile Touch Gestures: Drag from left wall edge or swipe open/close
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 1024) return;
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    const isEdgeDrag = !isMobileMenuOpen && clientX <= EDGE_DRAG_ZONE;
    const isOpenDrag = isMobileMenuOpen;

    if (isEdgeDrag || isOpenDrag) {
      touchStateRef.current = {
        startX: clientX,
        startY: clientY,
        isEdgeDrag,
        isOpenDrag,
        isTracking: true,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStateRef.current.isTracking || window.innerWidth >= 1024) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStateRef.current.startX;
    const deltaY = touch.clientY - touchStateRef.current.startY;

    // Detect predominantly horizontal movement
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      if (touchStateRef.current.isEdgeDrag) {
        // Dragging open from left edge wall
        if (deltaX > 5) {
          setIsDragging(true);
          const currentOffset = Math.min(0, -DRAWER_WIDTH + deltaX);
          setDragOffset(currentOffset);
        }
      } else if (touchStateRef.current.isOpenDrag) {
        // Dragging closed towards left
        if (deltaX < -5) {
          setIsDragging(true);
          const currentOffset = Math.min(0, deltaX);
          setDragOffset(currentOffset);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStateRef.current.isTracking || window.innerWidth >= 1024) {
      setIsDragging(false);
      setDragOffset(null);
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStateRef.current.startX;

    if (isDragging && dragOffset !== null) {
      if (touchStateRef.current.isEdgeDrag) {
        // Snap open if dragged right > 25% of drawer
        if (deltaX >= DRAWER_WIDTH * 0.25) {
          setIsMobileMenuOpen(true);
        } else {
          setIsMobileMenuOpen(false);
        }
      } else if (touchStateRef.current.isOpenDrag) {
        // Snap closed if dragged left > 25% of drawer
        if (deltaX <= -DRAWER_WIDTH * 0.25) {
          setIsMobileMenuOpen(false);
        } else {
          setIsMobileMenuOpen(true);
        }
      }
    }

    setIsDragging(false);
    setDragOffset(null);
    touchStateRef.current = {
      startX: 0,
      startY: 0,
      isEdgeDrag: false,
      isOpenDrag: false,
      isTracking: false,
    };
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-200 overflow-hidden relative"
    >
      {/* Edge drag affordance on mobile */}
      {!isMobileMenuOpen && (
        <div 
          className="fixed left-0 top-14 bottom-0 w-6 z-30 lg:hidden pointer-events-auto select-none"
          aria-hidden="true"
        />
      )}

      <Header onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)} />

      <div className="flex flex-1 pt-14 sm:pt-16 min-h-0 overflow-hidden relative min-w-0">
        <Sidebar
          isOpen={isMobileMenuOpen}
          isDragging={isDragging}
          dragOffset={dragOffset}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main 
          className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
