import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { StaffProfileModal } from '../ui/StaffProfileModal';
import { AppWalkthroughModal } from '../ui/AppWalkthroughModal';
import { NotificationsModal, getSystemNotifications } from '../ui/NotificationsModal';
import { LoadingScreen } from '../ui/LoadingScreen';
import { triggerAppRefresh } from '../ui/SplashScreen';
import { useRealtimeSync } from '../../services/realtimeSync';
import { pushLocalToCloud, pullCloudToLocal } from '../../services/cloudSync';
import logoImg from '../../assets/logo.png';
import { 
  Building2, 
  Sun, 
  Moon, 
  ShieldCheck, 
  LogOut,
  BellRing,
  Menu,
  RotateCw,
  Compass
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showWalkthroughModal, setShowWalkthroughModal] = useState(false);
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
    logout();
    navigate('/login', { replace: true });
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
        className="app-header fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-6 transition-colors duration-200 shadow-2xs w-full flex items-center justify-between"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0.35rem)',
          minHeight: 'var(--header-height, 3.5rem)',
          height: 'var(--header-height, 3.5rem)',
        }}
      >
        <div className="flex items-center justify-between gap-2 w-full max-w-full">
          
          {/* Left: Hamburger (Mobile) + Back Button + Logo Branding & Active Role Indicator */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0 min-w-0">
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="lg:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs shrink-0"
                title="Open Navigation Drawer"
                aria-label="Toggle Mobile Menu"
              >
                <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-slate-200" />
              </button>
            )}

            <div className="flex items-center space-x-2 shrink-0">
              <img 
                src={logoImg} 
                alt="E-RiKON Logo" 
                className="h-7 sm:h-8 md:h-9 w-auto object-contain shrink-0"
              />
              <div className="flex flex-col">
                <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white tracking-tight leading-tight hidden xs:inline">
                  E-RiKON
                </span>
                <span className="text-[9px] text-[#0d9488] dark:text-teal-400 font-mono font-bold leading-none hidden sm:inline">
                  Financial Co. LTD
                </span>
              </div>
              <span className="hidden md:inline-flex text-[#0d9488] font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/40 font-mono shrink-0 ml-1">
                ECFMS v2.0
              </span>
            </div>
          </div>

          {/* Right: Controls, System Actions, Notifications & User Identity Profile (Strictly Right-Aligned) */}
          <div className="flex items-center justify-end space-x-1.5 sm:space-x-2.5 shrink-0 ml-auto">
            
            {/* Active Workstation Role Badge (Desktop) */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="hidden xl:flex items-center bg-[#0a3866] hover:bg-[#082d52] text-white px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer border border-[#0e4b85] shrink-0"
              title="Click to view Staff Profile & Permissions"
            >
              <span className="text-[11px] font-black uppercase tracking-wider">
                {currentUser.role.replace(/_/g, ' ')} WORKSTATION
              </span>
            </button>

            {/* App Walkthrough & Interactive Guide Button (Desktop Only) */}
            <button
              type="button"
              onClick={() => setShowWalkthroughModal(true)}
              className="hidden lg:flex w-8 h-8 sm:w-9 sm:h-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#0d9488] dark:hover:text-teal-400 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs group shrink-0"
              title="Open System Walkthrough & Interactive Guide"
            >
              <Compass className="w-4 h-4 text-[#0d9488] group-hover:rotate-45 transition-transform duration-300" />
            </button>

            {/* Instant Full System Refresh & Cloud Sync Button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await pushLocalToCloud();
                  await pullCloudToLocal();
                } catch {}
                triggerAppRefresh();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#0d9488] dark:hover:text-teal-400 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer group shadow-2xs shrink-0"
              title="Refresh Page & Sync Latest Cloud Data"
            >
              <RotateCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500 text-[#0d9488]" />
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#0d9488] dark:hover:text-teal-400 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs shrink-0"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* System Notifications Bell Button with Active Pulsating Counter */}
            <button
              type="button"
              onClick={() => setShowNotificationsModal(true)}
              className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#0d9488] transition-all border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs shrink-0"
              title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'No new notifications'}
            >
              <BellRing className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black font-mono flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-sm animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Profile Badge & Logout Control */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
              <div
                onClick={() => setShowProfileModal(true)}
                className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer group p-0.5 sm:p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all shrink-0"
                title="View Staff Identity Profile"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#0a3866] via-[#0d9488] to-[#166534] flex items-center justify-center text-white text-[11px] sm:text-xs font-black shadow-xs ring-2 ring-teal-500/30 group-hover:ring-[#0d9488] shrink-0">
                  {currentUser.firstName[0]}{currentUser.lastName[0]}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 group-hover:text-[#0d9488] transition-colors leading-tight">
                    {currentUser.firstName} {currentUser.lastName}
                    <ShieldCheck className="w-3 h-3 text-emerald-500 inline" />
                  </div>
                  <div className="text-[9px] text-[#0d9488] dark:text-teal-400 font-extrabold tracking-wider uppercase leading-tight">
                    {currentUser.role.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {/* Logout / Switch Role Button */}
              <button
                type="button"
                onClick={handleLogoutClick}
                className="w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 transition-all text-xs font-bold cursor-pointer shadow-2xs shrink-0"
                title="Logout to Role Login Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Switch Role</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* App Onboarding & System Walkthrough Modal */}
      <AppWalkthroughModal
        isOpen={showWalkthroughModal}
        onClose={() => setShowWalkthroughModal(false)}
      />

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
