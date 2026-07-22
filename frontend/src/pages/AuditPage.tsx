import React, { useState } from 'react';
import { MOCK_AUDIT_LOGS } from '../services/api';
import { StaffInfoPopupModal } from '../components/ui/StaffInfoPopupModal';
import { ShieldAlert, ShieldCheck, UserCheck, Laptop, Globe, Clock } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null);

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

        <div className="flex items-center space-x-2 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono w-fit">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Audit Log Lock: IMMUTABLE
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 min-w-0">
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
              {MOCK_AUDIT_LOGS.map((log) => (
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
      </div>

      {/* Staff Info Popup Modal */}
      <StaffInfoPopupModal
        staffName={selectedStaffName}
        onClose={() => setSelectedStaffName(null)}
      />

    </div>
  );
};
