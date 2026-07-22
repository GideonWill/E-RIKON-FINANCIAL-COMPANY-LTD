import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  Landmark, 
  Smartphone, 
  Calculator, 
  GitBranch, 
  FileSpreadsheet, 
  ShieldAlert,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return null;

  const activeRole = currentUser.role;

  const navItems = [
    {
      to: '/',
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
    },
    {
      to: '/customers',
      label: 'Customer 360',
      icon: Users,
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
    },
    {
      to: '/accounts',
      label: 'Savings & Accounts',
      icon: Wallet,
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
    },
    {
      to: '/teller',
      label: 'Teller Workstation',
      icon: Landmark,
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'TELLER'],
    },
    {
      to: '/field-officer',
      label: 'Field Collections (31-Day)',
      icon: Smartphone,
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'FIELD_OFFICER'],
    },
    {
      to: '/loans',
      label: 'ER-Fast Loans Desk',
      icon: Calculator,
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LOAN_OFFICER', 'AUDITOR'],
    },
    {
      to: '/branches',
      label: 'Branch Operations',
      icon: GitBranch,
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'AUDITOR'],
    },
    {
      to: '/reports',
      label: 'Financial Reports',
      icon: FileSpreadsheet,
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
    },
    {
      to: '/audit',
      label: 'Immutable Audit Trail',
      icon: ShieldAlert,
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'AUDITOR'],
    },
  ];

  const allowedNav = navItems.filter((item) => item.roles.includes(activeRole));

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full p-4 space-y-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 pb-3 lg:border-b-0 lg:pb-0">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Workstation Scopes
            </div>
            <div className="text-xs text-amber-400 font-semibold mt-0.5">
              Role: {activeRole.replace('_', ' ')}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="space-y-1">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-3 sm:py-2.5 rounded-xl font-medium text-xs sm:text-xs transition-all ${
                    isActive
                      ? 'bg-amber-500 text-white font-bold shadow-lg shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4.5 h-4.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Box */}
      <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs space-y-1">
        <div className="font-semibold text-slate-200">E-RIKON GROUP LTD</div>
        <p className="text-[11px] text-slate-400">RBAC Workstation Isolation Active</p>
        <div className="pt-2 text-[10px] text-amber-400/90 font-mono">
          Policy: 31-Day Savings & Tiered Loans
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Pinned on large screens) */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-61px)] border-r border-slate-800 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Off-Canvas Drawer (Slide-over on smaller screens) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />

          {/* Drawer Container */}
          <aside className="relative z-10 w-4/5 max-w-xs bg-slate-900 text-slate-300 h-full shadow-2xl flex flex-col border-r border-slate-800">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
