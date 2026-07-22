import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, X, CheckCircle2, ShieldAlert, Sparkles, Clock, Calculator, Wallet, ArrowRight } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'LOAN' | 'DEPOSIT' | 'CYCLE' | 'SYSTEM';
  targetRoute: string;
  isRead: boolean;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'ER-Fast Loan Disbursed',
      message: 'Loan LN-APP-2026-901 (GHS 5,000.00) disbursed for Kwadwo Adjei.',
      time: '10 mins ago',
      type: 'LOAN',
      targetRoute: '/loans',
      isRead: false,
    },
    {
      id: 'notif-2',
      title: '31-Day Savings Cycle Completed',
      message: 'Cycle #1 completed for Kwadwo Adjei. Day 31 fee (GHS 100.00) retained by company.',
      time: '25 mins ago',
      type: 'CYCLE',
      targetRoute: '/accounts',
      isRead: false,
    },
    {
      id: 'notif-3',
      title: 'Physical Cash Deposit Recorded',
      message: 'Teller Abena Osei recorded GHS 3,100.00 deposit at Accra Central Branch.',
      time: '1 hour ago',
      type: 'DEPOSIT',
      targetRoute: '/teller',
      isRead: true,
    },
    {
      id: 'notif-4',
      title: 'Vault Cash Reconciliation',
      message: 'Accra Main Branch Vault balanced successfully at GHS 124,800.00.',
      time: '2 hours ago',
      type: 'SYSTEM',
      targetRoute: '/branches',
      isRead: true,
    },
  ]);

  if (!isOpen) return null;

  const handleNotificationClick = (item: NotificationItem) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
    onClose();
    navigate(item.targetRoute);
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'LOAN':
        return <Calculator className="w-4 h-4 text-purple-400" />;
      case 'CYCLE':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'DEPOSIT':
        return <Wallet className="w-4 h-4 text-emerald-400" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-blue-400" />;
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
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                System Notifications
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Click any notification to navigate directly to its module
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

        {/* Notifications List */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {notifications.map((n) => (
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
          ))}
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
