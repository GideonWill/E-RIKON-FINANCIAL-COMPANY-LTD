import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredAccounts, deleteCustomerRecord } from '../services/api';
import { useRealtimeSync } from '../services/realtimeSync';
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
  FileText,
  UserPlus,
  ArrowRight,
  Coins,
  Trash2
} from 'lucide-react';

export const AccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(accounts[0] || null);

  // Real-time multi-device subscription
  useRealtimeSync(() => {
    const fresh = getStoredAccounts();
    setAccounts(fresh);
    if (!selectedAccount && fresh.length > 0) {
      setSelectedAccount(fresh[0]);
    } else if (selectedAccount) {
      const updated = fresh.find((a) => a.id === selectedAccount.id);
      if (updated) setSelectedAccount(updated);
    }
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Wallet className="w-6 h-6 text-amber-500" />
          Savings Accounts & 31-Day Policy Tracker
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Monitor customer savings schemes, available balances, upfront package fees, and early withdrawal protections
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Wallet className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              No Savings Accounts Opened Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Onboard your first client on the Customers page to open a savings account with a Ghana Cedis package (GH₵ 5 - 200).
            </p>
          </div>
          <button
            onClick={() => navigate('/customers')}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Go to Customer Registration</span>
          </button>
        </div>
      ) : (
        /* Main Grid */
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
                      <h4 className={`font-extrabold text-sm mt-0.5 ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {acc.customer?.firstName} {acc.customer?.lastName}
                      </h4>
                      <div className={`text-[11px] ${isSelected ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>{acc.type.replace(/_/g, ' ')}</div>
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
                      className="bg-gradient-to-r from-amber-500 to-emerald-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: 31-Day Interactive Visual Matrix */}
          <div className="lg:col-span-2 space-y-6">
            {selectedAccount ? (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                
                {/* Account Details Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      ACTIVE SAVINGS SCHEME (CYCLE #{selectedAccount.dailyCycles?.[0]?.cycleNumber || 1})
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mt-2">
                      {selectedAccount.customer?.firstName} {selectedAccount.customer?.lastName}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Account #{selectedAccount.accountNumber} • Ghana Card: {selectedAccount.customer?.ghanaCardNumber}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Deposited</div>
                      <div className="text-lg font-extrabold text-amber-500 font-mono">
                        GHS {selectedAccount.currentBalance.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        Available: GHS {selectedAccount.availableBalance.toFixed(2)}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const confirmed = window.confirm(
                          `⚠️ Close Account & Delete Client Record?\n\nClient: ${selectedAccount.customer?.firstName} ${selectedAccount.customer?.lastName}\nAccount: ${selectedAccount.accountNumber}\n\nAre you sure this client does not want to save anymore? This will permanently close the account and remove client records.`
                        );
                        if (confirmed && selectedAccount.customerId) {
                          deleteCustomerRecord(selectedAccount.customerId);
                          const fresh = getStoredAccounts();
                          setAccounts(fresh);
                          setSelectedAccount(fresh[0] || null);
                        }
                      }}
                      className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center justify-center cursor-pointer"
                      title="Close Account / Delete Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 31-Day Policy Visual Matrix */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      31-Day Contribution Calendar
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Daily Target: <span className="font-bold text-amber-500">GHS {selectedAccount.savingsPackage || selectedAccount.dailyCycles?.[0]?.dailyTargetAmount || 20}.00</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-7 sm:grid-cols-11 gap-2">
                    {Array.from({ length: 31 }, (_, i) => {
                      const dayNum = i + 1;
                      const activeCycle = selectedAccount.dailyCycles?.[0];
                      const isPaid = (activeCycle?.currentDayCount || 0) >= dayNum;
                      const isDay31 = dayNum === 31;

                      return (
                        <div
                          key={dayNum}
                          className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-between ${
                            isDay31
                              ? isPaid
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 ring-2 ring-rose-500/20'
                                : 'bg-slate-100 dark:bg-slate-950 text-slate-400 border-dashed border-rose-500/30'
                              : isPaid
                              ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-md shadow-amber-500/20'
                              : 'bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <span className="text-[9px] font-mono uppercase block opacity-80">
                            {isDay31 ? 'Fee' : `D${dayNum}`}
                          </span>
                          <span className="text-xs font-black font-mono my-0.5">
                            {isPaid ? (isDay31 ? '🏦' : '✓') : dayNum}
                          </span>
                          <span className="text-[8px] font-mono block truncate">
                            {isPaid ? (isDay31 ? 'Retained' : 'Paid') : 'Due'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Policy Guidance Alert */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    30-Day Savings, Day-31 Retention & Savings Loan Policy
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    Days 1 through 30 contributions are 100% credited to the client's savings balance. On <b>Day 31</b>, the 31st contribution is retained as the E-RIKON management fee. If a client needs to withdraw early during the cycle, it is disbursed as a <b>loan against their savings</b>, with the 1-day retention fee strictly safeguarded and never eaten into.
                  </p>
                </div>

              </div>
            ) : null}
          </div>

        </div>
      )}

    </div>
  );
};
