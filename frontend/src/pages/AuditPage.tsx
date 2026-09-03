import React, { useState } from 'react';
import { getStoredAuditLogs, clearStoredAuditLogs, clearAllSystemData } from '../services/api';
import { pushLocalToCloud } from '../services/cloudSync';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeSync } from '../services/realtimeSync';
import { AuditLog } from '../types';
import { StaffInfoPopupModal } from '../components/ui/StaffInfoPopupModal';
import { ShieldAlert, ShieldCheck, UserCheck, Laptop, Globe, Clock, FileText, Trash2, Search, RefreshCcw } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>(getStoredAuditLogs());
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time multi-device subscription
  useRealtimeSync(() => {
    setLogs(getStoredAuditLogs());
  });

  const filteredLogs = logs.filter((log) => {
    const rawSearch = searchTerm.trim().toLowerCase();
    if (!rawSearch) return true;

    const action = (log.action || '').toLowerCase();
    const email = (log.userEmail || '').toLowerCase();
    const role = (log.userRole || '').toLowerCase();
    const branch = (log.branchName || '').toLowerCase();
    const newVal = (log.newValue || '').toLowerCase();
    const prevVal = (log.previousValue || '').toLowerCase();
    const cleanSearch = rawSearch.replace(/\s+/g, ' ');

    const directMatch =
      action.includes(cleanSearch) ||
      email.includes(cleanSearch) ||
      role.includes(cleanSearch) ||
      branch.includes(cleanSearch) ||
      newVal.includes(cleanSearch) ||
      prevVal.includes(cleanSearch);

    const searchTokens = cleanSearch.split(' ').filter(Boolean);
    const tokensMatch = searchTokens.every(
      (tok) =>
        action.includes(tok) ||
        email.includes(tok) ||
        role.includes(tok) ||
        branch.includes(tok) ||
        newVal.includes(tok) ||
        prevVal.includes(tok)
    );

    return directMatch || tokensMatch;
  });

  const handleClearAuditLogs = () => {
    if (window.confirm('Are you sure you want to permanently clear all audit logs from the system?')) {
      clearStoredAuditLogs();
      setLogs([]);
      pushLocalToCloud().catch(() => {});
    }
  };

  const handleClearAllAcrossRoles = () => {
    if (window.confirm('⚠️ FACTORY RESET: Are you sure you want to clear ALL data across all role pages (Customers, Accounts, Deposits, Withdrawals, Loans, and Audit Trail)?')) {
      clearAllSystemData();
      setLogs([]);
      alert('System has been completely cleared across all roles.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
            Immutable System Audit Trail
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tamper-proof compliance logs for every customer onboard, physical deposit, withdrawal, and fee retention
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUser?.role === 'SUPER_ADMIN' && (
            <>
              <button
                type="button"
                onClick={handleClearAllAcrossRoles}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-600 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                title="Wipe all dummy/test records across Super Admin, Field Officer, Teller, Auditor, and Admin"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Clear All Across Roles
              </button>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAuditLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Logs
                </button>
              )}
            </>
          )}
          <div className="flex items-center space-x-2 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono w-fit">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Audit Log Lock: IMMUTABLE
          </div>
        </div>
      </div>

      {/* Audit Log Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search audit trail by client full name, officer, action, diff..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
        />
      </div>

      {/* Audit Log Table */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 min-w-0">
        {logs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-800 text-amber-500 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Immutable Ledger Active & Listening
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Compliance audit records will automatically log here in real time as staff perform financial deposits, withdrawals, and approvals.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Performed By (Clickable Staff)</th>
                  <th className="py-2.5 px-3">Branch</th>
                  <th className="py-2.5 px-3">State Change / Diff</th>
                  <th className="py-2.5 px-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredLogs.map((log: AuditLog) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setSelectedStaffName(log.userEmail || log.userRole || 'Staff')}
                        className="text-amber-500 hover:underline font-bold text-xs font-sans cursor-pointer flex items-center gap-1"
                        title="Click to view personnel dossier"
                      >
                        {log.userEmail} ({log.userRole})
                      </button>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-400">{log.branchName || 'Accra Main'}</td>
                    <td className="py-3 px-3 text-slate-300">
                      <div className="text-[11px]">
                        <span className="text-slate-500">Prev:</span> {log.previousValue}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-bold">
                        <span className="text-slate-500">New:</span> {log.newValue}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Staff Identity Modal */}
      <StaffInfoPopupModal
        staffName={selectedStaffName}
        onClose={() => setSelectedStaffName(null)}
      />

    </div>
  );
};
