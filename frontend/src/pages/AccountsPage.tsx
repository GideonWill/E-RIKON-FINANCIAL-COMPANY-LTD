import React, { useState } from 'react';
import { getStoredAccounts } from '../services/api';
import { Account } from '../types';
import { 
  Wallet, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Building2, 
  TrendingUp, 
  ShieldAlert,
  HelpCircle,
  FileText
} from 'lucide-react';

export const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [selectedAccount, setSelectedAccount] = useState<Account>(accounts[0] || getStoredAccounts()[0]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Wallet className="w-6 h-6 text-amber-500" />
          Savings Accounts & 31-Day Policy Tracker
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Monitor customer savings schemes, available balances, and automatic 31st day company fee deductions
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Account Selection Cards */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Customer Accounts</h3>
          {accounts.map((acc) => {
            const isSelected = selectedAccount?.id === acc.id;
            const cycle = acc.dailyCycles?.[0];
            const currentDay = cycle ? cycle.currentDayCount : 0;
            const progress = Math.min(100, Math.round((currentDay / 31) * 100));

            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className={`p-5 rounded-3xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-gradient-to-br from-slate-900 to-slate-950 text-white border-amber-500 shadow-xl ring-2 ring-amber-500/30'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-mono text-amber-500 font-extrabold">{acc.accountNumber}</div>
                    <h4 className="font-extrabold text-sm mt-0.5 text-slate-900 dark:text-white">
                      {acc.customer?.firstName} {acc.customer?.lastName}
                    </h4>
                    <div className="text-[11px] text-slate-400">{acc.type.replace('_', ' ')}</div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {acc.status}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Available Balance</span>
                    <span className="font-extrabold text-emerald-400">GHS {acc.availableBalance.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">31-Day Progress</span>
                    <span className="font-extrabold text-amber-400">{currentDay} / 31 Days</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-1.5 rounded-full"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Right Column: Detailed Account Ledger & 31-Day Policy Visualizer */}
        {selectedAccount && (
          <div className="lg:col-span-2 space-y-6">
            
            {/* 31-Day Cycle Visualizer Banner */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-white space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
                    E-RIKON 31-DAY SAVINGS POLICY METRICS
                  </span>
                  <h3 className="text-lg font-extrabold text-white">
                    Cycle Progress for {selectedAccount.customer?.firstName} {selectedAccount.customer?.lastName}
                  </h3>
                </div>
                <span className="text-xs bg-amber-500/20 text-amber-300 font-mono font-bold px-3 py-1 rounded-full border border-amber-500/30">
                  Cycle #1
                </span>
              </div>

              {/* Day 1 to 31 Day Step Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Day 1 (Start)</span>
                  <span className="text-emerald-400">Days 1–30: Client Savings Balance</span>
                  <span className="text-amber-400 font-bold">Day 31: Company Management Fee Retention</span>
                </div>

                <div className="grid grid-cols-8 sm:grid-cols-11 gap-1.5 pt-1">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                    const cycle = selectedAccount.dailyCycles?.[0];
                    const currentDayCount = cycle ? cycle.currentDayCount : 0;
                    const isCompletedDay = dayNum <= currentDayCount;
                    const isDay31 = dayNum === 31;

                    return (
                      <div
                        key={dayNum}
                        className={`p-1.5 rounded-lg text-center font-mono text-[10px] font-bold border transition-all ${
                          isDay31
                            ? isCompletedDay
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                              : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : isCompletedDay
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-600'
                        }`}
                        title={isDay31 ? 'Day 31 Company Retention Fee' : `Day ${dayNum} Deposit`}
                      >
                        D{dayNum}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cycle Financial Summary */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Total Deposited</span>
                  <span className="font-extrabold text-white text-sm">
                    GHS {((selectedAccount.dailyCycles?.[0]?.dailyTargetAmount || 100) * (selectedAccount.dailyCycles?.[0]?.currentDayCount || 0)).toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Client Available</span>
                  <span className="font-extrabold text-emerald-400 text-sm">
                    GHS {selectedAccount.availableBalance.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase block">Company Fee Retained</span>
                  <span className="font-extrabold text-amber-400 text-sm">
                    GHS {(selectedAccount.dailyCycles?.[0]?.companyFeeAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>

            </div>

            {/* Account Information Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                Account Overview & Ledger Audit
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Account Number</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedAccount.accountNumber}</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Account Type</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedAccount.type}</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Opening Date</span>
                  <span className="font-bold text-slate-900 dark:text-white">{new Date(selectedAccount.openingDate).toLocaleDateString()}</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Account Branch</span>
                  <span className="font-bold text-amber-500">{selectedAccount.branch?.name || 'Accra Main'}</span>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
