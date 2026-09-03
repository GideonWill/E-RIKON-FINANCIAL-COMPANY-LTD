import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getStoredApprovals } from '../../services/api';
import { useRealtimeSync } from '../../services/realtimeSync';
import { 
  Squares2X2Icon, 
  UsersIcon, 
  WalletIcon, 
  BuildingLibraryIcon, 
  DevicePhoneMobileIcon, 
  CalculatorIcon, 
  DocumentChartBarIcon, 
  ShieldExclamationIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  isOpen?: boolean;
  isDragging?: boolean;
  dragOffset?: number | null;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen = false, 
  isDragging = false,
  dragOffset = null,
  onClose 
}) => {
  const { currentUser } = useAuth();
  const [approvals, setApprovals] = useState(getStoredApprovals());

  const refreshApprovals = () => {
    setApprovals(getStoredApprovals());
  };

  // Listen for local and real-time approval updates
  useEffect(() => {
    refreshApprovals();
    window.addEventListener('erikon_realtime_update', refreshApprovals);
    window.addEventListener('storage', refreshApprovals);
    return () => {
      window.removeEventListener('erikon_realtime_update', refreshApprovals);
      window.removeEventListener('storage', refreshApprovals);
    };
  }, []);

  useRealtimeSync(() => {
    refreshApprovals();
  });

  if (!currentUser) return null;

  const activeRole = currentUser.role;
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;

  const navSections = [
    {
      title: 'Governance & Vault',
      items: [
        {
          to: '/',
          label: 'Executive Dashboard',
          icon: Squares2X2Icon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
        },
        {
          to: '/approvals',
          label: 'Approvals Hub',
          icon: ShieldCheckIcon,
          badge: activeRole === 'SUPER_ADMIN' && pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
          roles: ['SUPER_ADMIN'],
        },
        {
          to: '/company-interest',
          label: 'Company Interest Vault',
          icon: BanknotesIcon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'],
        },
      ],
    },
    {
      title: 'Operations & Cash Desk',
      items: [
        {
          to: '/customers',
          label: 'Customer 360',
          icon: UsersIcon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
        },
        {
          to: '/accounts',
          label: 'Savings & Packages',
          icon: WalletIcon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
        },
        {
          to: '/teller',
          label: 'Teller Workstation',
          icon: BuildingLibraryIcon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'TELLER'],
        },
        {
          to: '/field-officer',
          label: 'Field Collections',
          icon: DevicePhoneMobileIcon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'FIELD_OFFICER'],
        },
      ],
    },
    {
      title: 'Credit, Reports & Audit',
      items: [
        {
          to: '/loans',
          label: 'ER-Fast Loans Desk',
          icon: CalculatorIcon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'LOAN_OFFICER', 'AUDITOR'],
        },
        {
          to: '/reports',
          label: 'Financial Statements',
          icon: DocumentChartBarIcon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
        },
        {
          to: '/end-of-day',
          label: 'End of Day (EOD) Close',
          icon: CalendarDaysIcon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
        },
        {
          to: '/audit',
          label: 'Immutable Audit Trail',
          icon: ShieldExclamationIcon,
          roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'],
        },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full p-4 space-y-4 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800">
      <div className="space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Workstation Scope
            </div>
            <div className="text-xs text-[#0d9488] font-black mt-0.5">
              Role: {activeRole.replace(/_/g, ' ')}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Drawer"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {navSections.map((sec) => {
            const visibleItems = sec.items.filter((item) => item.roles.includes(activeRole));
            if (visibleItems.length === 0) return null;

            return (
              <div key={sec.title} className="space-y-1">
                <div className="px-3.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {sec.title}
                </div>
                <nav className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-3.5 py-2 rounded-xl text-xs transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-[#0d9488] via-[#059669] to-[#166534] text-white font-black shadow-md shadow-emerald-900/20'
                              : 'text-slate-600 dark:text-slate-300 hover:text-[#065f46] hover:bg-teal-50/70 dark:hover:bg-slate-800/60 font-semibold'
                          }`
                        }
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge !== undefined && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white font-mono shadow-sm">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-50/90 to-emerald-50/90 dark:from-slate-800/80 dark:to-slate-800/50 border border-teal-200/80 dark:border-slate-700/60 text-xs space-y-1">
        <div className="font-black text-slate-900 dark:text-white">
          E-RiKON <span className="text-[#0d9488]">Financial Company PLC</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">RBAC Workstation Clearance Active</p>
        <div className="pt-1.5 text-[10px] text-[#166534] dark:text-teal-400 font-mono font-bold">
          Policy: 30-Day Interest & GH₵ 5-200 Packages
        </div>
      </div>
    </div>
  );

  const isVisible = isOpen || isDragging;
  const currentTranslate = isDragging && dragOffset !== null
    ? dragOffset
    : isOpen ? 0 : -280;

  const backdropOpacity = isDragging && dragOffset !== null
    ? Math.max(0, Math.min(0.6, ((280 + dragOffset) / 280) * 0.6))
    : isOpen ? 0.6 : 0;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-y-auto shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer with Edge-Drag Gestures and Smooth Sliding Effect */}
      <div 
        className={`fixed inset-0 z-50 lg:hidden ${
          isVisible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        style={{
          visibility: isVisible ? 'visible' : 'hidden',
          transition: isDragging ? 'none' : 'visibility 0.28s',
        }}
      >
        {/* Backdrop Overlay */}
        <div 
          className="fixed inset-0 bg-slate-950 backdrop-blur-xs"
          style={{
            opacity: backdropOpacity,
            transition: isDragging ? 'none' : 'opacity 0.28s ease',
            pointerEvents: isOpen ? 'auto' : 'none',
          }}
          onClick={onClose}
        />

        {/* Sliding Drawer Container */}
        <div 
          className="relative flex flex-col w-[280px] max-w-[85vw] h-full bg-white dark:bg-slate-900 shadow-2xl z-10"
          style={{
            transform: `translateX(${currentTranslate}px)`,
            transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
            paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)',
          }}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
};
