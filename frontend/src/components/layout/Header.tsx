import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { StaffProfileModal } from '../ui/StaffProfileModal';
import { NotificationsModal } from '../ui/NotificationsModal';
import { LoadingScreen } from '../ui/LoadingScreen';
import { subscribeRealtimeEvents } from '../../services/realtimeSync';
import logoImg from '../../assets/logo.jpeg';
import { 
  Building2, 
  Sun, 
  Moon, 
  ShieldCheck, 
  LogOut,
  BellRing,
  Menu
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [, setLastSyncTime] = useState<string>('Just now');

  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents(() => {
      setLastSyncTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    });

    const handleCustom = () => {
      setLastSyncTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    window.addEventListener('erikon_realtime_update', handleCustom);
    return () => {
      unsubscribe();
      window.removeEventListener('erikon_realtime_update', handleCustom);
    };
  }, []);

  const handleLogoutClick = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      logout();
      setIsLoggingOut(false);
    }, 3000); // 3-second classy logout loading duration
  };

  if (!currentUser) return null;

  return (
    <>
      {isLoggingOut && (
        <LoadingScreen 
          message="Terminating Workstation Session & Securing Ledger..."
        />
      )}

      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 transition-colors duration-200">
        <div className="flex items-center justify-between">
          
          {/* Left: Hamburger Toggle Button (Mobile) + Organization Branding & Active Branch */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Open Navigation Menu"
                aria-label="Toggle Mobile Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center space-x-2 sm:space-x-3">
              <img 
                src={logoImg} 
                alt="E-RIKON Logo" 
                className="h-8 sm:h-12 w-auto object-contain"
              />
              <span className="text-amber-500 font-bold text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30">
                ECFMS v1.0
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              <span>{currentUser.branch?.name || 'Accra Main Branch'}</span>
            </div>
          </div>

          {/* Right: Controls, Real-time Sync Badge & User Profile Badge */}
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            
            {/* Live Multi-Device Realtime Sync Indicator */}
            <div 
              className="hidden xl:flex items-center space-x-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl text-xs font-mono font-bold"
              title="Real-Time Device Synchronization Active across all staff phones, tablets & desktops"
            >
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <span>REAL-TIME SYNC: ONLINE</span>
            </div>

            {/* Active Workstation Role Badge */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="hidden lg:flex items-center bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-xl transition-all cursor-pointer"
              title="Click to view Staff Profile & Permissions"
            >
              <span className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">
                {currentUser.role.replace('_', ' ')} WORKSTATION
              </span>
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* System Notifications Bell Button */}
            <button
              type="button"
              onClick={() => setShowNotificationsModal(true)}
              className="relative p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="View Live System Notifications"
            >
              <BellRing className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            </button>

            {/* User Profile Badge (Clickable to open Staff Profile Modal) */}
            <div className="flex items-center space-x-1.5 sm:space-x-3 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
              <div
                onClick={() => setShowProfileModal(true)}
                className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group p-0.5 sm:p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all"
                title="View Staff Identity Profile"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-white text-xs font-bold ring-2 ring-amber-500/40 group-hover:ring-amber-500">
                  {currentUser.firstName[0]}{currentUser.lastName[0]}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 group-hover:text-amber-500 transition-colors">
                    {currentUser.firstName} {currentUser.lastName}
                    <ShieldCheck className="w-3 h-3 text-emerald-500 inline" />
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold tracking-wider uppercase">
                    {currentUser.role.replace('_', ' ')}
                  </div>
                </div>
              </div>

              {/* Logout / Switch Role Button */}
              <button
                type="button"
                onClick={handleLogoutClick}
                className="p-1.5 sm:p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/30 transition-all text-xs flex items-center gap-1 font-bold cursor-pointer"
                title="Logout to Role Login Portal"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Switch Role</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Staff Identity Profile Modal */}
      <StaffProfileModal
        isOpen={showProfileModal}
        user={currentUser}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Live System Notifications Modal */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />
    </>
  );
};
