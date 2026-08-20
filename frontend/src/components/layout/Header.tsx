import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { StaffProfileModal } from '../ui/StaffProfileModal';
import { NotificationsModal, getSystemNotifications } from '../ui/NotificationsModal';
import { LoadingScreen } from '../ui/LoadingScreen';
import { useRealtimeSync } from '../../services/realtimeSync';
import logoImg from '../../assets/logo.png';
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
  const [unreadCount, setUnreadCount] = useState(0);

  const calculateUnreadCount = () => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    const notifs = getSystemNotifications(currentUser.role);
    const unread = notifs.filter((n) => !n.isRead && n.roles.includes(currentUser.role)).length;
    setUnreadCount(unread);
  };

  useEffect(() => {
    calculateUnreadCount();
    window.addEventListener('erikon_realtime_update', calculateUnreadCount);
    window.addEventListener('storage', calculateUnreadCount);
    return () => {
      window.removeEventListener('erikon_realtime_update', calculateUnreadCount);
      window.removeEventListener('storage', calculateUnreadCount);
    };
  }, [currentUser]);

  useRealtimeSync(() => {
    calculateUnreadCount();
  });

  const handleLogoutClick = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      logout();
      setIsLoggingOut(false);
    }, 2000);
  };

  if (!currentUser) return null;

  return (
    <>
      {isLoggingOut && (
        <LoadingScreen 
          message="Terminating Workstation Session & Securing Ledger..."
        />
      )}

      <header 
        className="app-header sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3.5 sm:px-6 transition-colors duration-200 shadow-2xs"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)',
          paddingBottom: '0.75rem',
        }}
      >
        <div className="flex items-center justify-between">
          
          {/* Left: Hamburger Toggle Button (Mobile) + Organization Branding & Active Branch */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                title="Open Navigation Menu"
                aria-label="Toggle Mobile Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center space-x-2 sm:space-x-3">
              <img 
                src={logoImg} 
                alt="E-RiKON Logo" 
                className="h-8 sm:h-9 w-auto object-contain"
              />
              <span className="text-[#0d9488] font-black text-[9px] sm:text-[10px] px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/40 font-mono">
                ECFMS v2.0
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-2 bg-slate-100/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80">
              <Building2 className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>{currentUser.branch?.name || 'Accra Main Branch'}</span>
            </div>
          </div>

          {/* Right: Controls, Real-time Sync Badge & User Profile Badge */}
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            
            {/* Active Workstation Role Badge matching Logo Navy & Teal */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="hidden lg:flex items-center bg-[#0a3866] hover:bg-[#082d52] text-white px-3 py-1 rounded-xl shadow-xs transition-all cursor-pointer border border-[#0e4b85]"
              title="Click to view Staff Profile & Permissions"
            >
              <span className="text-xs font-black uppercase tracking-wider">
                {currentUser.role.replace(/_/g, ' ')} WORKSTATION
              </span>
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#0d9488] dark:hover:text-teal-400 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* System Notifications Bell Button - Only shows indicator if unreadCount > 0 */}
            <button
              type="button"
              onClick={() => setShowNotificationsModal(true)}
              className="relative p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#0d9488] transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'No new notifications'}
            >
              <BellRing className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              )}
            </button>

            {/* User Profile Badge (Clickable to open Staff Profile Modal) */}
            <div className="flex items-center space-x-1.5 sm:space-x-3 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
              <div
                onClick={() => setShowProfileModal(true)}
                className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group p-0.5 sm:p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all"
                title="View Staff Identity Profile"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#0a3866] via-[#0d9488] to-[#166534] flex items-center justify-center text-white text-xs font-black shadow-xs ring-2 ring-teal-500/30 group-hover:ring-[#0d9488]">
                  {currentUser.firstName[0]}{currentUser.lastName[0]}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 group-hover:text-[#0d9488] transition-colors">
                    {currentUser.firstName} {currentUser.lastName}
                    <ShieldCheck className="w-3 h-3 text-emerald-500 inline" />
                  </div>
                  <div className="text-[10px] text-[#0d9488] dark:text-teal-400 font-bold tracking-wider uppercase">
                    {currentUser.role.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {/* Logout / Switch Role Button */}
              <button
                type="button"
                onClick={handleLogoutClick}
                className="p-1.5 sm:p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 transition-all text-xs flex items-center gap-1 font-bold cursor-pointer shadow-2xs"
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
        onNotificationsUpdated={calculateUnreadCount}
      />
    </>
  );
};
