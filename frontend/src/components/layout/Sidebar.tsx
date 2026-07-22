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
  ShieldAlert
} from 'lucide-react';

export const Sidebar: React.FC = () => {
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

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-61px)] p-4 flex flex-col justify-between border-r border-slate-800 shrink-0">
      <div className="space-y-6">
        <div className="px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Workstation Scopes
          </div>
          <div className="text-xs text-amber-400 font-semibold mt-0.5">
            Role: {activeRole.replace('_', ' ')}
          </div>
        </div>

        <nav className="space-y-1">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all ${
                    isActive
                      ? 'bg-amber-500 text-white font-bold shadow-lg shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
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
    </aside>
  );
};
