import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getStoredApprovals, getStoredTransactions } from '../../services/api';
import { useRealtimeSync, broadcastRealtimeEvent } from '../../services/realtimeSync';
import { RoleName } from '../../types';
import { 
  BellAlertIcon, 
  XMarkIcon, 
  ShieldExclamationIcon, 
  SparklesIcon, 
  ClockIcon, 
  CalculatorIcon, 
  WalletIcon, 
  ArrowRightIcon, 
  FunnelIcon, 
  DevicePhoneMobileIcon, 
  ShieldCheckIcon,
  TrashIcon,
  ArrowDownLeftIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'LOAN' | 'DEPOSIT' | 'WITHDRAWAL' | 'CYCLE' | 'SYSTEM' | 'FIELD' | 'AUDIT';
  targetRoute: string;
  targetState?: any;
  targetSectionId?: string;
  roles: RoleName[];
  isRead: boolean;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationsUpdated?: () => void;
}

export const getStoredReadNotificationIds = (): string[] => {
  try {
    const data = localStorage.getItem('erikon_read_notifications');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveStoredReadNotificationIds = (ids: string[]) => {
  try {
    localStorage.setItem('erikon_read_notifications', JSON.stringify(ids));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_realtime_update'));
  }
  broadcastRealtimeEvent('MANUAL_SYNC', { readNotifications: ids });
};

export const getStoredClearedNotificationIds = (): string[] => {
  try {
    const data = localStorage.getItem('erikon_cleared_notifications');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveStoredClearedNotificationIds = (ids: string[]) => {
  try {
    localStorage.setItem('erikon_cleared_notifications', JSON.stringify(ids));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_realtime_update'));
  }
  broadcastRealtimeEvent('MANUAL_SYNC', { clearedNotifications: ids });
};

export const getStoredDynamicNotifications = (): NotificationItem[] => {
  try {
    const data = localStorage.getItem('erikon_dynamic_notifications');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveStoredDynamicNotifications = (notifications: NotificationItem[]) => {
  try {
    localStorage.setItem('erikon_dynamic_notifications', JSON.stringify(notifications.slice(0, 50)));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_realtime_update'));
  }
};

export const clearAllNotifications = (role?: RoleName) => {
  const readIds = getStoredReadNotificationIds();
  const currentCleared = getStoredClearedNotificationIds();
  
  const txs = getStoredTransactions();
  const txIds = txs.map((t) => `tx-${t.id}`);
  const approvals = getStoredApprovals();
  const apprIds = approvals.map((a) => `appr-${a.id}`);
  const dynamic = getStoredDynamicNotifications();
  const dynamicIds = dynamic.map((d) => d.id);
  
  const allIdsToClear = Array.from(new Set([...currentCleared, ...txIds, ...apprIds, ...dynamicIds]));
  
  saveStoredClearedNotificationIds(allIdsToClear);
  saveStoredDynamicNotifications([]);
  saveStoredReadNotificationIds(Array.from(new Set([...readIds, ...allIdsToClear])));
};

export const addSystemNotification = (item: {
  title: string;
  message: string;
  type: 'LOAN' | 'DEPOSIT' | 'WITHDRAWAL' | 'CYCLE' | 'SYSTEM' | 'FIELD' | 'AUDIT';
  targetRoute: string;
  targetState?: any;
  targetSectionId?: string;
  roles: RoleName[];
}) => {
  const current = getStoredDynamicNotifications();
  const newItem: NotificationItem = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...item,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isRead: false,
  };
  saveStoredDynamicNotifications([newItem, ...current]);
};

export const getSystemNotifications = (role: RoleName): NotificationItem[] => {
  const readIds = getStoredReadNotificationIds();
  const clearedIds = getStoredClearedNotificationIds();
  const approvals = getStoredApprovals();
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');

  // Approval notifications are strictly restricted to SUPER_ADMIN
  const approvalNotifications: NotificationItem[] = role === 'SUPER_ADMIN'
    ? pendingApprovals.map((a) => ({
        id: `appr-${a.id}`,
        title: `Pending Clearance: ${a.title}`,
        message: `${a.description} • Requester: ${a.requestedByName} (${(a.requestedRole || 'STAFF').replace(/_/g, ' ')})`,
        time: a.createdAt ? new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
        type: a.type === 'STAFF_ROLE_SIGNUP' ? 'AUDIT' : a.type === 'LOAN_APPROVAL' ? 'LOAN' : 'CYCLE',
        targetRoute: '/approvals',
        targetState: { approvalId: a.id, viewMode: 'CLEARANCE_QUEUE' },
        targetSectionId: `approval-ticket-${a.id}`,
        roles: ['SUPER_ADMIN'] as RoleName[],
        isRead: readIds.includes(`appr-${a.id}`),
      }))
    : [];

  // Live transaction ledger notifications for all workstations (deposits, withdrawals, loans)
  const allStaffRoles: RoleName[] = ['SUPER_ADMIN', 'ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'];
  const transactions = getStoredTransactions();

  const transactionNotifications: NotificationItem[] = transactions
    .slice(0, 30)
    .map((tx) => {
      const isWithdrawal = tx.type === 'WITHDRAWAL';
      const isDeposit = tx.type === 'DEPOSIT';
      const isLoanDisbursed = tx.type === 'LOAN_DISBURSEMENT';
      const isLoanRepayment = tx.type === 'LOAN_REPAYMENT';
      const isFee = tx.type === 'COMPANY_FEE_DEDUCTION';

      const cust = tx.account?.customer;
      const clientName = cust
        ? `${cust.firstName} ${cust.lastName}`
        : tx.account?.accountNumber
        ? `Account ${tx.account.accountNumber}`
        : 'Registered Client';
      const amountStr = `GH₵ ${(tx.amount || 0).toFixed(2)}`;

      let title = `Transaction: ${amountStr}`;
      let notifType: NotificationItem['type'] = 'DEPOSIT';

      if (isWithdrawal) {
        title = `Client Withdrawal: ${amountStr}`;
        notifType = 'WITHDRAWAL';
      } else if (isDeposit) {
        title = `Client Deposit: ${amountStr}`;
        notifType = 'DEPOSIT';
      } else if (isLoanDisbursed) {
        title = `Loan Disbursed: ${amountStr}`;
        notifType = 'LOAN';
      } else if (isLoanRepayment) {
        title = `Loan Repayment: ${amountStr}`;
        notifType = 'LOAN';
      } else if (isFee) {
        title = `Day 31 Company Fee: ${amountStr}`;
        notifType = 'CYCLE';
      }

      const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date();
      const txMonth = tx.createdAt
        ? tx.createdAt.slice(0, 7)
        : `${txDate.getFullYear()}-${(txDate.getMonth() + 1).toString().padStart(2, '0')}`;
      const timeStr = txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const byUser = tx.recordedBy
        ? `${tx.recordedBy.firstName || ''} ${tx.recordedBy.lastName || ''}`.trim() || 'Staff'
        : 'Staff';
      const repStr = tx.transactor?.fullName ? ` • Transactor: ${tx.transactor.fullName}` : '';
      const message = `${clientName} (${tx.account?.accountNumber || 'Acc'}) • ${amountStr} ${tx.type?.toLowerCase().replace(/_/g, ' ')} by ${byUser}${repStr}`;

      return {
        id: `tx-${tx.id}`,
        title,
        message,
        time: timeStr,
        type: notifType,
        targetRoute: '/reports',
        targetState: {
          accountId: tx.accountId,
          customerId: tx.account?.customerId || tx.account?.customer?.id,
          month: txMonth,
          txId: tx.id,
        },
        targetSectionId: `statement-row-${tx.id}`,
        roles: allStaffRoles,
        isRead: readIds.includes(`tx-${tx.id}`),
      };
    });

  // Dynamic system update notifications for specific roles
  const dynamicNotifications: NotificationItem[] = getStoredDynamicNotifications()
    .filter((n) => n.roles.includes(role))
    .map((n) => ({
      ...n,
      isRead: readIds.includes(n.id) || n.isRead,
    }));

  // Merge and deduplicate by ID, prioritizing dynamic notification overrides if present
  const notifMap = new Map<string, NotificationItem>();
  approvalNotifications.forEach((n) => notifMap.set(n.id, n));
  transactionNotifications.forEach((n) => notifMap.set(n.id, n));
  dynamicNotifications.forEach((n) => notifMap.set(n.id, n));

  return Array.from(notifMap.values())
    .filter((n) => n.roles.includes(role))
    .filter((n) => !clearedIds.includes(n.id));
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, onNotificationsUpdated }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [filterMode, setFilterMode] = useState<'MY_ROLE' | 'ALL'>('MY_ROLE');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeRole = currentUser?.role || 'SUPER_ADMIN';

  const loadNotifications = () => {
    setNotifications(getSystemNotifications(activeRole));
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, activeRole]);

  useEffect(() => {
    const handleUpdate = () => {
      loadNotifications();
    };
    window.addEventListener('erikon_realtime_update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('erikon_realtime_update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [activeRole]);

  useRealtimeSync(() => {
    loadNotifications();
  });

  const displayedNotifications = useMemo(() => {
    return filterMode === 'MY_ROLE'
      ? notifications.filter((n) => n.roles.includes(activeRole))
      : notifications;
  }, [notifications, filterMode, activeRole]);

  const unreadCount = useMemo(() => {
    return displayedNotifications.filter((n) => !n.isRead).length;
  }, [displayedNotifications]);

  if (!isOpen) return null;

  const handleNotificationClick = (item: NotificationItem) => {
    const readIds = getStoredReadNotificationIds();
    if (!readIds.includes(item.id)) {
      saveStoredReadNotificationIds([...readIds, item.id]);
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
    if (onNotificationsUpdated) onNotificationsUpdated();
    onClose();

    // Direct targeted navigation with state
    navigate(item.targetRoute, { state: item.targetState });

    // Smooth scroll and focus highlight on target element
    if (item.targetSectionId) {
      setTimeout(() => {
        const el = document.getElementById(item.targetSectionId!);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-4', 'ring-teal-500', 'transition-all');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-teal-500');
          }, 3500);
        }
      }, 150);
    }
  };

  const handleDismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentCleared = getStoredClearedNotificationIds();
    const updated = Array.from(new Set([...currentCleared, id]));
    saveStoredClearedNotificationIds(updated);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (onNotificationsUpdated) onNotificationsUpdated();
  };

  const markAllAsRead = () => {
    const allIds = displayedNotifications.map((n) => n.id);
    const readIds = getStoredReadNotificationIds();
    const merged = Array.from(new Set([...readIds, ...allIds]));
    saveStoredReadNotificationIds(merged);

    // Also mark dynamic notifications as read in storage
    const dynamic = getStoredDynamicNotifications();
    if (dynamic.length > 0) {
      saveStoredDynamicNotifications(dynamic.map((d) => ({ ...d, isRead: true })));
    }

    // Immediately update local state for instantaneous UI response
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    setStatusMessage('All notifications marked as read');
    setTimeout(() => setStatusMessage(null), 2500);

    if (onNotificationsUpdated) onNotificationsUpdated();
  };

  const handleClearAll = () => {
    const displayedIds = displayedNotifications.map((n) => n.id);
    const currentCleared = getStoredClearedNotificationIds();
    const updatedCleared = Array.from(new Set([...currentCleared, ...displayedIds]));
    saveStoredClearedNotificationIds(updatedCleared);
    saveStoredDynamicNotifications([]);

    // Immediately clear displayed notifications
    setNotifications((prev) => prev.filter((n) => !displayedIds.includes(n.id)));

    setStatusMessage('All notifications cleared successfully');
    setTimeout(() => setStatusMessage(null), 2500);

    if (onNotificationsUpdated) onNotificationsUpdated();
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'LOAN':
        return <CalculatorIcon className="w-4 h-4 text-purple-500" />;
      case 'CYCLE':
        return <SparklesIcon className="w-4 h-4 text-amber-500" />;
      case 'DEPOSIT':
        return <WalletIcon className="w-4 h-4 text-emerald-500" />;
      case 'WITHDRAWAL':
        return <ArrowDownLeftIcon className="w-4 h-4 text-rose-500" />;
      case 'FIELD':
        return <DevicePhoneMobileIcon className="w-4 h-4 text-blue-500" />;
      case 'AUDIT':
        return <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />;
      default:
        return <ShieldExclamationIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0d9488] border border-teal-200 dark:bg-teal-950/40 dark:border-teal-800">
              <BellAlertIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                Workstation Alerts
                <span className="text-[10px] bg-teal-50 text-[#0d9488] font-black px-2 py-0.5 rounded-full border border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 uppercase">
                  {(activeRole || 'STAFF').replace(/_/g, ' ')}
                </span>
                {unreadCount > 0 && (
                  <span className="text-[9px] bg-emerald-500 text-white font-black px-1.5 py-0.5 rounded-full shadow-xs">
                    {unreadCount} NEW
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tailored notification feed for your active role
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Transient Status Feedback Alert */}
        {statusMessage && (
          <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-bold animate-pulse">
            <CheckCircleIcon className="w-4 h-4 text-[#0d9488]" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center space-x-1 font-bold text-slate-500 pl-2 text-[11px]">
            <FunnelIcon className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Scope:</span>
          </div>

          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setFilterMode('MY_ROLE')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                filterMode === 'MY_ROLE'
                  ? 'bg-teal-50 text-[#0d9488] border border-teal-200 dark:bg-teal-950/60 dark:border-teal-800 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              My Role
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-teal-50 text-[#0d9488] border border-teal-200 dark:bg-teal-950/60 dark:border-teal-800 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              All Roles
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1">
          {displayedNotifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs space-y-1.5">
              <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="font-bold text-slate-700 dark:text-slate-200">No active notifications</p>
              <p className="text-[11px] opacity-70">Everything is caught up and synchronized!</p>
            </div>
          ) : (
            displayedNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer group space-y-1.5 relative ${
                  n.isRead
                    ? 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-100 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'bg-emerald-50/30 dark:bg-teal-950/20 border-teal-300 dark:border-teal-700/60 shadow-xs hover:border-[#0d9488]'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold gap-2">
                  <span className="flex items-center gap-1.5 text-[#065f46] dark:text-teal-400 group-hover:underline truncate">
                    {getIcon(n.type)}
                    <span className="truncate">{n.title}</span>
                  </span>
                  
                  <div className="flex items-center space-x-2 shrink-0">
                    {n.isRead ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                        <CheckCircleIcon className="w-2.5 h-2.5 text-slate-400" />
                        Read
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-emerald-500 text-white shadow-xs animate-pulse">
                        NEW
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                      <ClockIcon className="w-3 h-3" /> {n.time}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleDismissNotification(n.id, e)}
                      className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title="Dismiss notification"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug pr-4">
                  {n.message}
                </p>

                <div className="pt-1 flex items-center justify-end text-[10px] text-[#0d9488] font-bold group-hover:translate-x-0.5 transition-transform">
                  <span>Take Action</span>
                  <ArrowRightIcon className="w-3 h-3 ml-1" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={displayedNotifications.length === 0}
            onClick={handleClearAll}
            className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-40 disabled:cursor-not-allowed border border-rose-200 dark:border-rose-900/50 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            title="Clear all alerts from feed"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Clear All</span>
          </button>
          
          <button
            type="button"
            disabled={displayedNotifications.length === 0 || unreadCount === 0}
            onClick={markAllAsRead}
            className="flex-1 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-[#0d9488] dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40 disabled:opacity-40 disabled:cursor-not-allowed border border-teal-200 dark:border-teal-800 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          >
            <CheckCircleIcon className="w-4 h-4" />
            <span>Mark All as Read</span>
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer active:scale-95"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

