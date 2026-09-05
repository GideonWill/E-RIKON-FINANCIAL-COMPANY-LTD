import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getStoredAccounts, getStoredTransactions, deleteCustomerRecord, startNewCycleForAccount } from '../services/api';
import { useRealtimeSync } from '../services/realtimeSync';
import { useAuth } from '../contexts/AuthContext';
import { addSystemNotification } from '../components/ui/NotificationsModal';
import { Account } from '../types';
import {
  WalletIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  BuildingOffice2Icon,
  ArrowTrendingUpIcon,
  ShieldExclamationIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  UserPlusIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  CurrencyDollarIcon,
  TrashIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import { EditCustomerRecordModal } from '../components/ui/EditCustomerRecordModal';
import { Customer } from '../types';

export const AccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(accounts[0] || null);
  const [selectedCycleNumber, setSelectedCycleNumber] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const matrixRef = useRef<HTMLDivElement>(null);

  const handleSelectAccount = (acc: Account) => {
    setSelectedAccount(acc);
    setSelectedCycleNumber(null);
    setTimeout(() => {
      matrixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Listen for direct navigation from Workstation Alerts / Notifications
  const processedLocationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const stateObj = location.state as { accountId?: string; customerId?: string; search?: string } | null;
    if (stateObj && processedLocationKeyRef.current !== location.key) {
      if (stateObj.accountId || stateObj.customerId) {
        const freshAccs = accounts.length > 0 ? accounts : getStoredAccounts();
        const found = freshAccs.find((a) => a.id === stateObj.accountId || a.customerId === stateObj.customerId);
        if (found) {
          processedLocationKeyRef.current = location.key;
          setSelectedAccount(found);
          setTimeout(() => {
            const el = document.getElementById(`account-card-${found.id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-4', 'ring-teal-500', 'transition-all');
              setTimeout(() => {
                el.classList.remove('ring-4', 'ring-teal-500');
              }, 3500);
            }
          }, 150);

          if (stateObj.search) {
            setSearchTerm(stateObj.search);
          }

          window.history.replaceState({}, document.title);
          navigate(location.pathname + location.search, { replace: true, state: null });
        }
      } else {
        processedLocationKeyRef.current = location.key;
        if (stateObj.search) {
          setSearchTerm(stateObj.search);
        }
        window.history.replaceState({}, document.title);
        navigate(location.pathname + location.search, { replace: true, state: null });
      }
    }
  }, [location.key, location.state, accounts, navigate, location.pathname, location.search]);

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

  const filteredAccounts = accounts.filter((acc) => {
    const rawSearch = searchTerm.trim().toLowerCase();
    if (!rawSearch) return true;

    const firstName = (acc.customer?.firstName || '').toLowerCase();
    const lastName = (acc.customer?.lastName || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    const revFullName = `${lastName} ${firstName}`.trim();
    const accNumber = (acc.accountNumber || '').toLowerCase();
    const ghanaCard = (acc.customer?.ghanaCardNumber || '').toLowerCase();
    const ghanaCardNoHyphen = ghanaCard.replace(/-/g, '');
    const phone = (acc.customer?.phone || '').replace(/\s+/g, '');
    const cleanSearch = rawSearch.replace(/\s+/g, ' ');
    const cleanSearchNoHyphen = cleanSearch.replace(/-/g, '');

    const directMatch =
      fullName.includes(cleanSearch) ||
      revFullName.includes(cleanSearch) ||
      firstName.includes(cleanSearch) ||
      lastName.includes(cleanSearch) ||
      accNumber.includes(cleanSearch) ||
      ghanaCard.includes(cleanSearch) ||
      ghanaCardNoHyphen.includes(cleanSearchNoHyphen) ||
      phone.includes(cleanSearch.replace(/\s+/g, ''));

    const searchTokens = cleanSearch.split(' ').filter(Boolean);
    const tokensMatch = searchTokens.every(
      (tok) =>
        fullName.includes(tok) ||
        accNumber.includes(tok) ||
        ghanaCard.includes(tok) ||
        ghanaCardNoHyphen.includes(tok.replace(/-/g, '')) ||
        phone.includes(tok)
    );

    return directMatch || tokensMatch;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <WalletIcon className="w-6 h-6 text-amber-500" />
          Savings Accounts & 31-Day Policy Tracker
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Monitor customer savings schemes, available balances, multi-cycle histories, and 1-day retention fee protections
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <WalletIcon className="w-8 h-8" />
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
            <UserPlusIcon className="w-4 h-4" />
            <span>Go to Customer Registration</span>
          </button>
        </div>
      ) : (
        /* Main Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Account Selection Cards */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                Active Client Accounts ({filteredAccounts.length})
              </div>
            </div>

            {/* Quick Client Search Input */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by full name, account, card..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
              />
            </div>

            {filteredAccounts.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  No accounts match "{searchTerm}"
                </p>
              </div>
            ) : (
              filteredAccounts.map((acc) => {
              const isSelected = selectedAccount?.id === acc.id;
              const cycles = acc.dailyCycles || [];
              const activeCycle = cycles[0];
              const currentDay = activeCycle ? activeCycle.currentDayCount : 0;
              const progress = Math.min(100, Math.round((currentDay / 31) * 100));

              return (
                <div
                  key={acc.id}
                  id={`account-card-${acc.id}`}
                  onClick={() => handleSelectAccount(acc)}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-amber-500 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/30'
                      : 'bg-white dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-amber-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-mono text-amber-500 font-extrabold">{acc.accountNumber}</div>
                      <h4 className={`font-extrabold text-sm mt-0.5 ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {acc.customer?.firstName} {acc.customer?.lastName}
                      </h4>
                      <div className={`text-[11px] ${isSelected ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>{acc.type.replace(/_/g, ' ')} • GH₵ {acc.savingsPackage || 20}/Day</div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {acc.status}
                    </span>
                  </div>

                  {/* Financial Breakdown: Savings, Withdrawals, Net Balance */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-1.5 text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-slate-400 block">Total Savings</span>
                      <span className="font-extrabold text-blue-400">
                        GHS {((acc.dailyCycles || []).reduce((sum, c) => sum + (c.totalDeposited || 0), 0) || acc.currentBalance).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">Withdrawals</span>
                      <span className="font-extrabold text-rose-400">
                        GHS {getStoredTransactions().filter((t) => (t.accountId === acc.id || t.account?.id === acc.id) && t.type === 'WITHDRAWAL').reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block">Net Balance</span>
                      <span className="font-extrabold text-emerald-400">GHS {acc.availableBalance.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Cycle #{activeCycle?.cycleNumber || 1}</span>
                    <span className="font-extrabold text-amber-400">{currentDay} / 31 Days</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            }))}
          </div>

          {/* Right Column: 31-Day Interactive Visual Matrix & Client Detail Section */}
          <div ref={matrixRef} className="lg:col-span-2 space-y-6 scroll-mt-24">
            {selectedAccount ? (() => {
              const cycles = selectedAccount.dailyCycles || [];
              const activeCycle = selectedCycleNumber
                ? (cycles.find((c) => c.cycleNumber === selectedCycleNumber) || cycles[0])
                : cycles[0];
              const displayedCycleNo = activeCycle?.cycleNumber || 1;
              const allTxs = getStoredTransactions();
              const selectedWithdrawn = allTxs
                .filter((t) => (t.accountId === selectedAccount.id || t.account?.id === selectedAccount.id) && t.type === 'WITHDRAWAL')
                .reduce((sum, t) => sum + t.amount, 0);
              const selectedTotalSavings = cycles.reduce((sum, c) => sum + (c.totalDeposited || 0), 0) || selectedAccount.currentBalance;

              return (
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  
                  {/* Account Details Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        SAVINGS SCHEME (CYCLE #{displayedCycleNo})
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-2">
                        {selectedAccount.customer?.firstName} {selectedAccount.customer?.lastName}
                      </h3>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        Account #{selectedAccount.accountNumber} • Ghana Card: {selectedAccount.customer?.ghanaCardNumber}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/teller', { state: { accountId: selectedAccount.id, mode: 'DEPOSIT' } })}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all"
                        title="Record physical cash deposit for this client"
                      >
                        <ArrowUpRightIcon className="w-4 h-4" />
                        <span>Record Deposit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate('/teller', { state: { accountId: selectedAccount.id, mode: 'WITHDRAWAL' } })}
                        className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer transition-all"
                        title="Process physical cash withdrawal / loan for this client"
                      >
                        <ArrowDownLeftIcon className="w-4 h-4" />
                        <span>Record Withdrawal</span>
                      </button>

                      {currentUser?.role === 'SUPER_ADMIN' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedAccount.customer) {
                              setCustomerToEdit(selectedAccount.customer);
                              setIsEditModalOpen(true);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center gap-1.5 border border-amber-500/30 cursor-pointer transition-all"
                          title="Super Admin: Edit & Correct Customer KYC Details or Ledger Savings"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                          <span>Edit / Correct</span>
                        </button>
                      )}

                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 text-right">
                        <div className="px-2 border-r border-slate-200 dark:border-slate-800">
                          <div className="text-[9px] text-blue-500 uppercase font-bold">Total Savings</div>
                          <div className="text-xs font-black text-blue-500 font-mono">
                            GHS {selectedTotalSavings.toFixed(2)}
                          </div>
                        </div>
                        <div className="px-2 border-r border-slate-200 dark:border-slate-800">
                          <div className="text-[9px] text-rose-500 uppercase font-bold">Withdrawals</div>
                          <div className="text-xs font-black text-rose-500 font-mono">
                            GHS {selectedWithdrawn.toFixed(2)}
                          </div>
                        </div>
                        <div className="px-2">
                          <div className="text-[9px] text-emerald-500 uppercase font-bold">Net Balance</div>
                          <div className="text-sm font-black text-emerald-500 font-mono">
                            GHS {selectedAccount.availableBalance.toFixed(2)}
                          </div>
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
                        className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center justify-center cursor-pointer"
                        title="Close Account / Delete Record"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Multi-Cycle Selector */}
                  {cycles.length > 0 && (
                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
                      <div className="flex items-center gap-2 overflow-x-auto">
                        <span className="text-[10px] font-black text-slate-400 uppercase px-2 shrink-0">
                          Cycle History:
                        </span>
                        {cycles.map((c) => {
                          const isSelected = displayedCycleNo === c.cycleNumber;
                          const completed = c.isCompleted || c.currentDayCount >= 31;

                          return (
                            <button
                              key={c.cycleNumber}
                              type="button"
                              onClick={() => setSelectedCycleNumber(c.cycleNumber)}
                              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-500/40'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-amber-500 border border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <CurrencyDollarIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>Cycle #{c.cycleNumber}</span>
                              <span className="text-[10px] opacity-80">
                                {completed ? '• (Completed 31/31)' : `• (${c.currentDayCount}/31 Days)`}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {(cycles[0]?.isCompleted || cycles[0]?.currentDayCount >= 31) && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextNo = (cycles[0]?.cycleNumber || 1) + 1;
                            startNewCycleForAccount(selectedAccount.id, currentUser || undefined);
                            const fresh = getStoredAccounts();
                            setAccounts(fresh);
                            const updated = fresh.find((a) => a.id === selectedAccount.id);
                            if (updated) {
                              setSelectedAccount(updated);
                              setSelectedCycleNumber(updated.dailyCycles?.[0]?.cycleNumber || null);
                            }

                            addSystemNotification({
                              title: `New Cycle Started: Cycle #${nextNo}`,
                              message: `Cycle #${nextNo} initiated for ${selectedAccount.customer?.firstName} ${selectedAccount.customer?.lastName} (${selectedAccount.accountNumber}). Started by: ${currentUser?.firstName || 'Staff'}.`,
                              type: 'CYCLE',
                              targetRoute: '/accounts',
                              targetState: { accountId: selectedAccount.id },
                              targetSectionId: `account-card-${selectedAccount.id}`,
                              roles: ['SUPER_ADMIN', 'ADMIN', 'TELLER', 'FIELD_OFFICER', 'LOAN_OFFICER', 'AUDITOR'],
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-[11px] font-black shrink-0 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer transition-all"
                          title="Start Next 31-Day Cycle"
                        >
                          <SparklesIcon className="w-3.5 h-3.5" />
                          <span>Start Next Cycle (Cycle #{(cycles[0]?.cycleNumber || 1) + 1})</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* 31-Day Policy Visual Matrix */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarIcon className="w-4 h-4 text-amber-500" />
                        31-Day Contribution Calendar (Cycle #{displayedCycleNo})
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Daily Target: <span className="font-bold text-amber-500">GHS {selectedAccount.savingsPackage || activeCycle?.dailyTargetAmount || 20}.00</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-7 sm:grid-cols-11 gap-2">
                      {Array.from({ length: 31 }, (_, i) => {
                        const dayNum = i + 1;
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
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs space-y-1.5">
                    <div className="font-extrabold flex items-center gap-1.5 text-sm">
                      <ShieldExclamationIcon className="w-4 h-4 text-amber-500 shrink-0" />
                      30-Day Client Savings & Company Fee Retention Policy
                    </div>
                    <div className="text-[11px] opacity-90 leading-relaxed space-y-1">
                      <p>• <b>Daily Contributions:</b> Clients contribute daily according to their chosen package rate (GH₵ 5 – GH₵ 200/Day).</p>
                      <p>• <b>Fee Retention:</b> The company retains 1 day’s contribution as its management fee, which is deducted directly from the deposited money upon reaching the 31st contribution day, leaving 30 full contribution days credited to the client's available savings.</p>
                      <p>• <b>Savings-Backed Loan Withdrawals:</b> If a client requests a withdrawal during an active cycle, the amount is disbursed as a <b>loan against their accumulated savings</b>, ensuring the company’s 1-day retention fee remains fully safeguarded and cannot be eaten into.</p>
                    </div>
                  </div>

                </div>
              );
            })() : null}
          </div>

        </div>
      )}

      {/* Super Admin Customer Record & Financial Ledger Correction Modal */}
      <EditCustomerRecordModal
        isOpen={isEditModalOpen}
        customer={customerToEdit}
        account={selectedAccount}
        currentUser={currentUser}
        onClose={() => {
          setIsEditModalOpen(false);
          setCustomerToEdit(null);
        }}
        onSuccess={(_, updatedAcc) => {
          const fresh = getStoredAccounts();
          setAccounts(fresh);
          if (updatedAcc) {
            setSelectedAccount(updatedAcc);
          } else if (selectedAccount) {
            const found = fresh.find(a => a.id === selectedAccount.id);
            if (found) setSelectedAccount(found);
          }
        }}
      />

    </div>
  );
};
