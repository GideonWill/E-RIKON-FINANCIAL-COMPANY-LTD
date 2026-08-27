import React, { useState } from 'react';
import { 
  getStoredAccounts, 
  saveStoredAccounts, 
  recordPackageDeposit,
  splitPaymentIntoDays
} from '../services/api';
import { Account, Transaction, SavingsPackage, SAVINGS_PACKAGES } from '../types';
import { ReceiptPrinterModal } from '../components/ui/ReceiptPrinterModal';
import { useRealtimeSync } from '../services/realtimeSync';
import { useAuth } from '../contexts/AuthContext';
import { 
  Smartphone, 
  Search, 
  CalendarCheck, 
  CheckCircle2, 
  Sparkles, 
  MapPin, 
  Target,
  RotateCcw,
  Layers,
  History,
  Calendar,
  Zap,
  Clock,
  Coins
} from 'lucide-react';

export const FieldOfficerPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time multi-device subscription
  useRealtimeSync(() => {
    const fresh = getStoredAccounts();
    setAccounts(fresh);
    if (!selectedAccountId && fresh.length > 0) {
      setSelectedAccountId(fresh[0].id);
    }
  });
  
  // Selected Account
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  
  // Package & Amount Inputs
  const currentPackage = selectedAccount?.savingsPackage || 20;
  const [amountPaid, setAmountPaid] = useState<string>(currentPackage.toString());
  const [isBulkSplitMode, setIsBulkSplitMode] = useState<boolean>(false);
  const [backlogStartDate, setBacklogStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fieldRemarks, setFieldRemarks] = useState('');
  
  // Modals & Feedback
  const [printedTx, setPrintedTx] = useState<Transaction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Cycle State
  const activeCycle = selectedAccount?.dailyCycles?.[0];
  const currentDay = activeCycle ? activeCycle.currentDayCount : 0;
  const isCycleCompleted = currentDay >= 31;
  const targetCycleNo = isCycleCompleted ? (activeCycle ? activeCycle.cycleNumber + 1 : 1) : (activeCycle ? activeCycle.cycleNumber : 1);

  // Live Split Preview Calculation
  const numAmount = Number(amountPaid) || 0;
  let splitPreview = null;
  if (numAmount > 0 && currentPackage > 0) {
    try {
      splitPreview = splitPaymentIntoDays(
        currentPackage,
        numAmount,
        isCycleCompleted ? 0 : currentDay,
        backlogStartDate
      );
    } catch {
      splitPreview = null;
    }
  }

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    const term = searchQuery.toLowerCase();
    const name = `${acc.customer?.firstName} ${acc.customer?.lastName}`.toLowerCase();
    const phone = acc.customer?.phone || '';
    const accNo = acc.accountNumber.toLowerCase();
    return name.includes(term) || phone.includes(term) || accNo.includes(term);
  });

  const handlePackageChange = (pkg: SavingsPackage) => {
    if (!selectedAccount) return;
    const updatedAcc = { ...selectedAccount, savingsPackage: pkg };
    const updatedList = accounts.map((a) => (a.id === updatedAcc.id ? updatedAcc : a));
    setAccounts(updatedList);
    saveStoredAccounts(updatedList);
    setAmountPaid(pkg.toString());
  };

  const handleRecordCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0 || !selectedAccount) return;

    if (numAmount < currentPackage) {
      alert(`❌ Deposit amount (GH₵ ${numAmount.toFixed(2)}) cannot be lower than the chosen package rate (GH₵ ${currentPackage}.00). Minimum deposit is GH₵ ${currentPackage}.00.`);
      return;
    }

    if (numAmount % currentPackage !== 0) {
      alert(`❌ Deposit amount (GH₵ ${numAmount.toFixed(2)}) must be an exact multiple of the GH₵ ${currentPackage}.00 package (e.g. GH₵ ${currentPackage}, GH₵ ${currentPackage * 2}, GH₵ ${currentPackage * 3}) to split evenly across days.`);
      return;
    }

    const officer = currentUser || {
      id: 'user-05',
      employeeId: 'EMP-009',
      firstName: 'Kofi',
      lastName: 'Appiah',
      email: 'field.officer@erikon-group.com',
      phone: '+233 24 999 8877',
      role: 'FIELD_OFFICER' as const,
      branchId: 'br-01',
    };

    try {
      const { updatedAccount, transaction, splitResult } = recordPackageDeposit(
        selectedAccount.id,
        numAmount,
        officer,
        fieldRemarks || (isBulkSplitMode ? 'Backlog / Old records multi-day entry' : undefined),
        backlogStartDate
      );

      const refreshedAccounts = getStoredAccounts();
      setAccounts(refreshedAccounts);
      setPrintedTx(transaction);
      setFieldRemarks('');

      setSuccessMessage(
        `✅ Recorded GHS ${numAmount.toFixed(2)} for ${selectedAccount.customer?.firstName} ${selectedAccount.customer?.lastName}! Automatically spread across ${splitResult.daysCovered} day(s) (Days ${splitResult.startDay} to ${splitResult.endDay}) on the GH₵ ${currentPackage} Package.${splitResult.isDay31Included ? ' 🌟 Day 31 company management fee retained & added to Company Interest Vault!' : ''}`
      );
    } catch (err: any) {
      alert(err.message || 'Error recording deposit');
    }
  };

  const handleConfirmPaid = (tx: Transaction) => {
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-amber-500" />
            Field Collections & Multi-Day Splitter (GH₵ 5 - 200 Packages)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Mobile Onsite Daily Savings Collections, Historical Records Back-filling, and 30-Day Cycle Rollovers
          </p>
        </div>

        {/* Target Card */}
        <div className="flex items-center space-x-3 bg-slate-900 text-white p-3 rounded-2xl border border-slate-800">
          <Target className="w-5 h-5 text-amber-400" />
          <div className="text-xs font-mono">
            <div className="text-[10px] text-slate-400 uppercase">Today's Route Collections</div>
            <div className="font-bold text-amber-400">
              GHS {accounts.reduce((total, acc) => {
                const todayIso = new Date().toISOString().split('T')[0];
                const todaySplits = (acc.dailyCycles?.flatMap((c) => c.dailySplits || []) || []).filter((s) => s.date === todayIso);
                return total + todaySplits.reduce((sum, s) => sum + s.amount, 0);
              }, 0).toFixed(2)} (0% Variance)
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500 text-white font-bold text-xs flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-white hover:text-slate-200 font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Client Route List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Route Clients ({filteredAccounts.length})</h3>
            <span className="text-[10px] font-mono text-amber-500 font-bold">Live Route Ledger</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client name, phone or card..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredAccounts.map((acc) => {
              const isSelected = selectedAccount?.id === acc.id;
              const accCycle = acc.dailyCycles?.[0];
              const currentCount = accCycle ? accCycle.currentDayCount : 0;
              const accCycleNo = accCycle ? accCycle.cycleNumber : 1;
              const pkg = acc.savingsPackage || 20;

              return (
                <div
                  key={acc.id}
                  onClick={() => {
                    setSelectedAccountId(acc.id);
                    setAmountPaid(pkg.toString());
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-amber-500 text-white shadow-md ring-2 ring-amber-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className={`font-extrabold text-xs ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      {acc.customer?.firstName} {acc.customer?.lastName}
                    </h4>
                    <span className="font-mono text-xs font-bold text-amber-500 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                      GH₵ {pkg}/day
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    <span className="font-mono">Cycle #{accCycleNo} • Day {currentCount}/31</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-200">GHS {acc.currentBalance.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-rose-500 flex-shrink-0" /> {acc.customer?.address}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Collection Desk, Package Selector & Multi-Day Splitter */}
        {selectedAccount && (
          <div className="lg:col-span-8 space-y-6">
            
            {/* Target Client Info Header */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      ONSITE DAILY COLLECTION
                    </span>
                    <span className="text-xs font-mono text-slate-400">{selectedAccount.accountNumber}</span>
                  </div>
                  <h3 className="font-extrabold text-xl text-slate-900 dark:text-white mt-1">
                    {selectedAccount.customer?.firstName} {selectedAccount.customer?.lastName}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Phone: {selectedAccount.customer?.phone} | Ghana Card: {selectedAccount.customer?.ghanaCardNumber}
                  </div>
                </div>

                <div className="text-right flex sm:flex-col items-center sm:items-end justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Client Savings</span>
                  <div className="text-2xl font-black text-amber-500 font-mono">
                    GHS {selectedAccount.availableBalance.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Savings Package Selection (Ghana Cedis: 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span>Monthly Savings Package (in Ghana Cedis) *</span>
                  </label>
                  <span className="text-[11px] text-amber-500 font-bold font-mono">
                    Active: GH₵ {currentPackage}.00 / Day
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {SAVINGS_PACKAGES.map((pkg) => {
                    const isSelected = currentPackage === pkg;
                    return (
                      <button
                        type="button"
                        key={pkg}
                        onClick={() => handlePackageChange(pkg)}
                        className={`py-2 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.02]'
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-500/50'
                        }`}
                      >
                        GH₵ {pkg}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode Switcher: Single Day vs Multi-Day Old Records Splitter */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Multi-Day Automatic Payment Splitter</div>
                    <div className="text-[10px] text-slate-500">Spread bulk payments (e.g. GH₵ 100 on GH₵ 20 package = 5 days) for fast entry & old records</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBulkSplitMode(!isBulkSplitMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isBulkSplitMode
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isBulkSplitMode ? '⚡ Multi-Day Split Active' : 'Single Day Mode'}
                </button>
              </div>

              {/* Collection Input Form */}
              <form onSubmit={handleRecordCollection} className="space-y-4 text-xs">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Total Amount Received from Client (GHS) *
                    </label>
                    <input
                      required
                      type="number"
                      step="1"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-black text-lg focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {isBulkSplitMode && (
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        <span>Starting Date (For Past / Old Records)</span>
                      </label>
                      <input
                        type="date"
                        value={backlogStartDate}
                        onChange={(e) => setBacklogStartDate(e.target.value)}
                        className="w-full mt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Live Splitter Preview Box */}
                {splitPreview && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-900 dark:text-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-500 flex items-center gap-1.5 text-xs">
                        <Zap className="w-4 h-4" /> AUTOMATIC SPLIT CALCULATION:
                      </span>
                      <span className="font-mono font-bold text-xs bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                        {splitPreview.daysCovered} Day(s) Covered
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs pt-1">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Package Rate</span>
                        <span className="font-bold">GH₵ {splitPreview.packageAmount.toFixed(2)}/day</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Days Sequence</span>
                        <span className="font-bold text-amber-500">Days {splitPreview.startDay} to {splitPreview.endDay}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Total Deposited</span>
                        <span className="font-bold">GHS {splitPreview.totalPaid.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Company Day 31 Fee</span>
                        <span className="font-bold text-emerald-400">
                          {splitPreview.isDay31Included ? `GHS ${splitPreview.companyFeeIncluded.toFixed(2)} (Retained)` : 'GHS 0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Field Collection Notes / Reference</label>
                  <input
                    type="text"
                    value={fieldRemarks}
                    onChange={(e) => setFieldRemarks(e.target.value)}
                    placeholder="e.g. Makola market daily collection contribution"
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm flex items-center justify-center space-x-2 transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    Record GHS {numAmount.toFixed(2)} Payment & Generate Paperless Receipt
                  </span>
                </button>

              </form>

            </div>

            {/* 31-Day Interactive Savings Card / Visual Matrix */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <CalendarCheck className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      31-Day Cycle #{targetCycleNo} Collection Tracker
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      30 Days Customer Savings + 1 Day (Day 31) Company Management Fee Retention
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs font-bold text-amber-500">
                  {currentDay} / 31 Days Paid
                </div>
              </div>

              {/* 31 Days Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-10 gap-2">
                {Array.from({ length: 31 }, (_, idx) => {
                  const dayNum = idx + 1;
                  const isPaid = dayNum <= currentDay;
                  const isDay31 = dayNum === 31;
                  const splitEntry = activeCycle?.dailySplits?.find((s) => s.dayNumber === dayNum);

                  return (
                    <div
                      key={dayNum}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isPaid
                          ? isDay31
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md'
                            : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-mono">Day {dayNum}</div>
                      <div className="text-xs font-mono font-black mt-0.5">
                        {isPaid ? `GH₵${currentPackage}` : '—'}
                      </div>
                      <div className="text-[9px] truncate font-mono opacity-80 mt-0.5">
                        {isPaid ? (isDay31 ? 'Company Fee' : splitEntry?.date ? splitEntry.date.slice(5) : 'Paid') : 'Pending'}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

          </div>
        )}

      </div>

      {/* Receipt Modal */}
      <ReceiptPrinterModal
        transaction={printedTx}
        onClose={() => setPrintedTx(null)}
        onConfirmPaid={handleConfirmPaid}
      />

    </div>
  );
};
