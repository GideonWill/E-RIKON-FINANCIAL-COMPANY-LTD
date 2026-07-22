import React from 'react';
import { MOCK_BRANCHES } from '../services/api';
import { GitBranch, Building2, MapPin, Phone, ShieldCheck, DollarSign, Users } from 'lucide-react';

export const BranchesPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-amber-500" />
          Branch Operations & Performance
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Unlimited Branch Management, Cash Limits, Staff Assignments, and Regional Performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOCK_BRANCHES.map((b) => (
          <div
            key={b.id}
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-amber-500">{b.code}</span>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-0.5">{b.name}</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" /> {b.address}, {b.city} ({b.region})
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <Phone className="w-3.5 h-3.5 text-blue-500" /> {b.phone}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Cash Limit</span>
                <span className="font-bold text-slate-900 dark:text-white">GHS {b.cashLimit.toLocaleString('.2f')}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block">Active Staff</span>
                <span className="font-bold text-amber-500">12 Officers</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
