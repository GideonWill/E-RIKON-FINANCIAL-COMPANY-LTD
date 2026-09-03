import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getStoredApprovals } from '../../services/api';
import { useRealtimeSync } from '../../services/realtimeSync';
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
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export interface NotificationItem {
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
  localStorage.setItem('erikon_read_notifications', JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent('erikon_realtime_update'));
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
  localStorage.setItem('erikon_dynamic_notifications', JSON.stringify(notifications.slice(0, 50)));
  window.dispatchEvent(new CustomEvent('erikon_realtime_update'));
};

export const addSystemNotification = (item: {
  title: string;
  message: string;
  type: 'LOAN' | 'DEPOSIT' | 'CYCLE' | 'SYSTEM' | 'FIELD' | 'AUDIT';
  targetRoute: string;
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
  const approvals = getStoredApprovals();
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');

  // Approval notifications are strictly restricted to SUPER_ADMIN
  const approvalNotifications: NotificationItem[] = role === 'SUPER_ADMIN'
    ? pendingApprovals.map((a) => ({
        id: `appr-${a.id}`,
        title: `Pending Clearance: ${a.title}`,
        message: `${a.description} • Requester: ${a.requestedByName} (${a.requestedRole.replace(/_/g, ' ')})`,
        time: a.createdAt ? new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
        type: a.type === 'STAFF_ROLE_SIGNUP' ? 'AUDIT' : a.type === 'LOAN_APPROVAL' ? 'LOAN' : 'CYCLE',
        targetRoute: '/approvals',
        roles: ['SUPER_ADMIN'] as RoleName[],
        isRead: readIds.includes(`appr-${a.id}`),
      }))
    : [];

  // Dynamic system update notifications for specific roles
  const dynamicNotifications: NotificationItem[] = getStoredDynamicNotifications()
    .filter((n) => n.roles.includes(role))
    .map((n) => ({
      ...n,
      isRead: readIds.includes(n.id) || n.isRead,
    }));

  return [...approvalNotifications, ...dynamicNotifications];
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, onNotificationsUpdated }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [filterMode, setFilterMode] = useState<'MY_ROLE' | 'ALL'>('MY_ROLE');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const activeRole = currentUser?.role || 'SUPER_ADMIN';

  const loadNotifications = () => {
    setNotifications(getSystemNotifications(activeRole));
  };

  useEffect(() => {
    loadNotifications();
  }, [activeRole]);

  useRealtimeSync(() => {
    loadNotifications();
  });

  if (!isOpen) return null;

  const displayedNotifications = filterMode === 'MY_ROLE'
    ? notifications.filter((n) => n.roles.includes(activeRole))
    : notifications;

  const handleNotificationClick = (item: NotificationItem) => {
    const readIds = getStoredReadNotificationIds();
    if (!readIds.includes(item.id)) {
      saveStoredReadNotificationIds([...readIds, item.id]);
    }
    loadNotifications();
    if (onNotificationsUpdated) onNotificationsUpdated();
    onClose();
    navigate(item.targetRoute);
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const readIds = getStoredReadNotificationIds();
    const merged = Array.from(new Set([...readIds, ...allIds]));
    saveStoredReadNotificationIds(merged);
    loadNotifications();
    if (onNotificationsUpdated) onNotificationsUpdated();
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'LOAN':
        return <Calculator className="w-4 h-4 text-purple-500" />;
      case 'CYCLE':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'DEPOSIT':
        return <Wallet className="w-4 h-4 text-emerald-500" />;
      case 'FIELD':
        return <Smartphone className="w-4 h-4 text-blue-500" />;
      case 'AUDIT':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-slate-400" />;
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
            <div className="p-2 rounded-xl bg-teal-50 text-[#0d9488] border border-teal-200">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                Workstation Alerts
                <span className="text-[10px] bg-teal-50 text-[#0d9488] font-black px-2 py-0.5 rounded-full border border-teal-200 uppercase">
                  {activeRole.replace(/_/g, ' ')}
                </span>
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center space-x-1 font-bold text-slate-500 pl-2 text-[11px]">
            <Filter className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Scope:</span>
          </div>

          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setFilterMode('MY_ROLE')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                filterMode === 'MY_ROLE'
                  ? 'bg-[#0d9488] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {activeRole.replace(/_/g, ' ')} ({notifications.filter((n) => n.roles.includes(activeRole)).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All ({notifications.length})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {displayedNotifications.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 space-y-1">
              <p className="font-bold">No active alerts for {activeRole.replace(/_/g, ' ')} workstation.</p>
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
                    : 'bg-teal-50/80 dark:bg-teal-950/20 border-teal-300 dark:border-teal-700 text-slate-900 dark:text-white hover:border-[#0d9488] shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5 text-[#065f46] dark:text-teal-400 group-hover:underline">
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

                <div className="pt-1 flex items-center justify-end text-[10px] text-[#0d9488] font-bold group-hover:translate-x-0.5 transition-transform">
                  <span>Take Action</span>
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
            className="flex-1 py-2.5 rounded-xl bg-teal-50 text-[#0d9488] hover:bg-teal-100 border border-teal-200 font-bold text-xs transition-all cursor-pointer"
          >
            Mark All as Read
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
