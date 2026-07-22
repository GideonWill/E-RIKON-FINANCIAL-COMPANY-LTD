import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { LoadingScreen } from '../ui/LoadingScreen';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const [targetPath, setTargetPath] = useState(location.pathname);

  useEffect(() => {
    if (location.pathname !== targetPath) {
      setIsNavigating(true);
      setTargetPath(location.pathname);
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 500); // Smooth 500ms transition on screen switch
      return () => clearTimeout(timer);
    }
  }, [location.pathname, targetPath]);

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/accounts':
        return 'Loading Savings & 31-Day Policy Accounts...';
      case '/teller':
        return 'Opening Teller Cash Desk Workstation...';
      case '/field-officer':
        return 'Opening Field Collections Workstation...';
      case '/loans':
        return 'Loading ER-Fast Loans Desk...';
      case '/customers':
        return 'Loading Customer Management 360...';
      case '/reports':
        return 'Loading Financial Reports & Statements...';
      case '/audit':
        return 'Loading Immutable Compliance Trail...';
      case '/branches':
        return 'Loading Branch Operations & Vaults...';
      default:
        return 'Opening Workstation Screen...';
    }
  };

  return (
    <>
      {isNavigating && (
        <LoadingScreen 
          message={getPageTitle(location.pathname)}
        />
      )}

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200">
        <Header />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </>
  );
};
