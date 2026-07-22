import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RoleName } from '../../types';
import { 
  BellRing, 
  X, 
  ShieldAlert, 
  Sparkles, 
  Clock, 
  Calculator, 
  Wallet, 
  ArrowRight,
  Filter,
  Smartphone,
  Landmark,
  Building2,
  ShieldCheck
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'LOAN' | 'DEPOSIT' | 'CYCLE' | 'SYSTEM' | 'FIELD' | 'AUDIT';
  targetRoute: string;
  roles: RoleName[];
  isRead: boolean;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [filterMode, setFilterMode] = useState<'MY_ROLE' | 'ALL'>('MY_ROLE');

  const activeRole = currentUser?.role || 'SUPER_ADMIN';

  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>([
    // Teller Specific
    {
      id: 'notif-1',
      title: 'Vault Cash Reconciliation',
      message: 'Accra Main Branch Vault balanced successfully at GHS 124,800.00.',
      time: '5 mins ago',
      type: 'SYSTEM',
      targetRoute: '/teller',
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'TELLER'],
      isRead: false,
    },
    {
      id: 'notif-2',
      title: 'Physical Cash Deposit Recorded',
      message: 'Teller Abena Osei recorded GHS 3,100.00 physical deposit for ACC-1001-0891.',
      time: '15 mins ago',
      type: 'DEPOSIT',
      targetRoute: '/teller',
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'TELLER'],
      isRead: false,
    },

    // Field Officer Specific
    {
      id: 'notif-3',
      title: 'Onsite Field Collection Logged',
      message: 'Kwaku Mensah logged GHS 100.00 (Cycle #2 Day 2) for Kwadwo Adjei.',
      time: '20 mins ago',
      type: 'FIELD',
      targetRoute: '/field-officer',
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'FIELD_OFFICER'],
      isRead: false,
    },
    {
      id: 'notif-4',
      title: '31-Day Route Sync Complete',
      message: '14 mobile collections synced live from Ridge & Adum field officers.',
      time: '35 mins ago',
      type: 'FIELD',
      targetRoute: '/field-officer',
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'FIELD_OFFICER'],
      isRead: true,
    },

    // Loan Officer Specific
    {
      id: 'notif-5',
      title: 'ER-Fast Loan Application Pending',
      message: 'New loan request LN-APP-2026-901 (GHS 5,000.00) awaiting underwriting approval.',
      time: '10 mins ago',
      type: 'LOAN',
      targetRoute: '/loans',
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LOAN_OFFICER'],
      isRead: false,
    },
    {
      id: 'notif-6',
      title: 'Loan Disbursed & Tenor Calculated',
      message: 'Loan LN-APP-2026-880 disbursed with 5% monthly interest schedule.',
      time: '45 mins ago',
      type: 'LOAN',
      targetRoute: '/loans',
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LOAN_OFFICER', 'AUDITOR'],
      isRead: true,
    },

    // Branch Admin & Cycle Specific
    {
      id: 'notif-7',
      title: '31-Day Savings Cycle Completed',
      message: 'Cycle #1 complete for Kwadwo Adjei. Day 31 fee (GHS 100.00) retained by company.',
      time: '30 mins ago',
      type: 'CYCLE',
      targetRoute: '/accounts',
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'TELLER', 'FIELD_OFFICER', 'AUDITOR'],
      isRead: false,
    },
    {
      id: 'notif-8',
      title: 'Branch Cash Limit Alert',
      message: 'Accra Main Branch has reached 78% of daily allocated cash threshold.',
      time: '1 hour ago',
      type: 'SYSTEM',
      targetRoute: '/branches',
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'AUDITOR'],
      isRead: true,
    },

    // Auditor Specific
    {
      id: 'notif-9',
      title: 'Immutable Audit Log Generated',
      message: 'Role permissions and manual ledger entries verified tamper-proof.',
      time: '2 hours ago',
      type: 'AUDIT',
      targetRoute: '/audit',
      roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'AUDITOR'],
      isRead: true,
    },
  ]);

  if (!isOpen) return null;

  // Filter notifications tailored for the active role
  const displayedNotifications = filterMode === 'MY_ROLE'
    ? allNotifications.filter((n) => n.roles.includes(activeRole))
    : allNotifications;

  const handleNotificationClick = (item: NotificationItem) => {
    setAllNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
    onClose();
    navigate(item.targetRoute);
  };

  const markAllAsRead = () => {
    setAllNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'LOAN':
        return <Calculator className="w-4 h-4 text-purple-400" />;
      case 'CYCLE':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'DEPOSIT':
        return <Wallet className="w-4 h-4 text-emerald-400" />;
      case 'FIELD':
        return <Smartphone className="w-4 h-4 text-blue-400" />;
      case 'AUDIT':
        return <ShieldCheck className="w-4 h-4 text-rose-400" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                Workstation Alerts
                <span className="text-[10px] bg-amber-500/20 text-amber-500 dark:text-amber-400 font-extrabold px-2 py-0.5 rounded-full border border-amber-500/30 uppercase">
                  {activeRole.replace('_', ' ')}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tailored notification feed for your active role scope
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Tailor Filter Bar */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center space-x-1 font-bold text-slate-500 dark:text-slate-400 pl-2 text-[11px]">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            <span>Feed Filter:</span>
          </div>

          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setFilterMode('MY_ROLE')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                filterMode === 'MY_ROLE'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {activeRole.replace('_', ' ')} Scope ({allNotifications.filter((n) => n.roles.includes(activeRole)).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Alerts ({allNotifications.length})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {displayedNotifications.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 space-y-1">
              <p className="font-bold">No active alerts for {activeRole.replace('_', ' ')} workstation.</p>
              <p className="text-[11px]">All system processes operating cleanly within policy parameters.</p>
            </div>
          ) : (
            displayedNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all cursor-pointer group hover:scale-[1.01] ${
                  n.isRead
                    ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                    : 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 text-slate-900 dark:text-white hover:border-amber-500'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 group-hover:underline">
                    {getIcon(n.type)}
                    {n.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {n.time}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                  {n.message}
                </p>

                <div className="pt-1 flex items-center justify-end text-[10px] text-amber-500 font-bold group-hover:translate-x-0.5 transition-transform">
                  <span>Navigate to Module</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={markAllAsRead}
            className="flex-1 py-2.5 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 font-bold text-xs transition-all cursor-pointer"
          >
            Mark All as Read
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
