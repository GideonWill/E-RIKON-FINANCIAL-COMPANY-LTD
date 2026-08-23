import React, { useState, useEffect } from 'react';
import { 
  getStoredAccounts, 
  saveStoredAccounts, 
  getStoredTransactions, 
  saveStoredTransactions,
  accumulateCompanyInterest,
  recordPackageDeposit,
  splitPaymentIntoDays,
  toDecimal
} from '../services/api';
import { useRealtimeSync, broadcastRealtimeEvent } from '../services/realtimeSync';
import { Account, Transaction, PaymentMode, SavingsPackage, SAVINGS_PACKAGES, User } from '../types';
import { ReceiptPrinterModal } from '../components/ui/ReceiptPrinterModal';
import { 
  Landmark, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  ShieldAlert,
  CalendarCheck,
  Sparkles,
  Check,
  RotateCcw,
  Coins
} from 'lucide-react';

export const TellerPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account>(accounts[0] || getStoredAccounts()[0]);
  const [operationType, setOperationType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [amount, setAmount] = useState<string>('100');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('PHYSICAL_CASH');
  const [remarks, setRemarks] = useState('');
  const [chosenPackage, setChosenPackage] = useState<SavingsPackage>(selectedAccount?.savingsPackage || 20);
  const [isDailyPolicyTick, setIsDailyPolicyTick] = useState<boolean>(true);
  const [printedTx, setPrintedTx] = useState<Transaction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync package when selected account changes
  useEffect(() => {
    if (selectedAccount?.savingsPackage) {
      setChosenPackage(selectedAccount.savingsPackage);
    }
  }, [selectedAccount?.id, selectedAccount?.savingsPackage]);

  // Subscribe to real-time events from other devices/tabs
  useRealtimeSync(() => {
    const freshAccs = getStoredAccounts();
    setAccounts(freshAccs);
    if (selectedAccount) {
      const found = freshAccs.find((a) => a.id === selectedAccount.id);
      if (found) setSelectedAccount(found);
    } else if (freshAccs.length > 0) {
      setSelectedAccount(freshAccs[0]);
    }
  });

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.customer?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.customer?.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.customer?.ghanaCardNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCycle = selectedAccount?.dailyCycles?.[0];
  const currentDay = activeCycle ? activeCycle.currentDayCount : 0;
  const isCycleCompleted = currentDay >= 31;
  const targetCycleNo = isCycleCompleted ? (activeCycle ? activeCycle.cycleNumber + 1 : 1) : (activeCycle ? activeCycle.cycleNumber : 1);

  const numAmount = Number(amount) || 0;
  const splitPreview = numAmount > 0 ? splitPaymentIntoDays(chosenPackage, numAmount, isCycleCompleted ? 0 : currentDay) : null;

  const handleProcessTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0 || !selectedAccount) return;

    const tellerUser: User = {
      id: 'user-03',
      employeeId: 'EMP-005',
      firstName: 'Abena',
      lastName: 'Osei',
      email: 'teller@erikon-group.com',
      phone: '0245556677',
      role: 'TELLER',
      branchId: 'br-01',
    };

    if (operationType === 'DEPOSIT') {
      if (numAmount < chosenPackage) {
        alert(`❌ Deposit amount (GH₵ ${numAmount.toFixed(2)}) cannot be lower than the chosen package rate (GH₵ ${chosenPackage}.00). Minimum deposit is GH₵ ${chosenPackage}.00.`);
        return;
      }

      if (numAmount % chosenPackage !== 0) {
        alert(`❌ Deposit amount (GH₵ ${numAmount.toFixed(2)}) must be an exact multiple of the GH₵ ${chosenPackage}.00 package (e.g. GH₵ ${chosenPackage}, GH₵ ${chosenPackage * 2}, GH₵ ${chosenPackage * 3}) to split evenly across days.`);
        return;
      }

      // Ensure account package matches chosen package
      const allAccs = getStoredAccounts();
      const currentAccIndex = allAccs.findIndex((a) => a.id === selectedAccount.id);
      if (currentAccIndex !== -1) {
        allAccs[currentAccIndex].savingsPackage = chosenPackage;
        saveStoredAccounts(allAccs);
      }

      const { updatedAccount, transaction, splitResult } = recordPackageDeposit(
        selectedAccount.id,
        numAmount,
        tellerUser,
        remarks || `Teller deposit on GH₵ ${chosenPackage}/day package`
      );

      setSelectedAccount(updatedAccount);
      setAccounts(getStoredAccounts());
      setPrintedTx(transaction);

      setSuccessMessage(
        `🎉 Deposit of GHS ${numAmount.toFixed(2)} recorded! Covered ${splitResult.daysCovered} days (Days ${splitResult.startDay} to ${splitResult.endDay}) on GH₵ ${chosenPackage}/day package.`
      );
    } else {
      // Withdrawal
      if (numAmount > selectedAccount.availableBalance) {
        alert(`❌ Insufficient available balance. Current available: GHS ${selectedAccount.availableBalance.toFixed(2)}`);
        return;
      }

      const previousBal = selectedAccount.availableBalance;
      const newBal = toDecimal(previousBal - numAmount);

      const updatedAcc = {
        ...selectedAccount,
        availableBalance: newBal,
        currentBalance: toDecimal(selectedAccount.currentBalance - numAmount),
      };

      const newTx: Transaction = {
        id: `tx-with-${Date.now()}`,
        referenceNo: `TX-WITH-${Date.now().toString().slice(-8)}`,
        receiptNo: `RCP-WITH-${Date.now().toString().slice(-8)}`,
        accountId: selectedAccount.id,
        account: updatedAcc,
        type: 'WITHDRAWAL',
        paymentMode,
        amount: numAmount,
        previousBal,
        newBal,
        recordedBy: tellerUser,
        remarks: remarks || `Physical cash withdrawal across the counter`,
        createdAt: new Date().toISOString(),
      };

      const freshAccs = getStoredAccounts();
      const idx = freshAccs.findIndex((a) => a.id === selectedAccount.id);
      if (idx !== -1) {
        freshAccs[idx] = updatedAcc;
        saveStoredAccounts(freshAccs);
      }

      const txs = getStoredTransactions();
      saveStoredTransactions([newTx, ...txs]);

      setSelectedAccount(updatedAcc);
      setAccounts(freshAccs);
      setPrintedTx(newTx);
      broadcastRealtimeEvent('WITHDRAWAL_RECORDED', newTx);

      setSuccessMessage(`✅ Physical withdrawal of GHS ${numAmount.toFixed(2)} completed successfully!`);
    }

    setAmount('100');
    setRemarks('');
  };

  const handleConfirmPaid = (tx: Transaction) => {
    setSuccessMessage(
      `✅ Money Paid Successfully! GHS ${tx.amount.toFixed(2)} recorded for ${tx.account?.customer?.firstName} ${tx.account?.customer?.lastName}.`
    );
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header - Fully Responsive on iPhone & Desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0" />
            <span>Teller Workstation & Cash Desk</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Manual Physical Deposit, 31-Day Savings Contribution Ticking & Withdrawal Processing
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3.5 py-2 rounded-xl border border-emerald-500/20 text-xs font-mono font-bold w-fit shrink-0 shadow-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" /> 
          <span>Vault Cash Balanced: GHS 124,800.00</span>
        </div>
      </div>

      {/* Success Notification Banner (Auto-dismisses in 3 seconds) */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-between shadow-xl animate-pulse">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5" />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Customer Account Selector */}
        <div className="space-y-4">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center space-x-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search account by Name, Acc # or Ghana Card..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none placeholder-slate-400"
            />
          </div>

          <div className="space-y-3">
            {filteredAccounts.map((acc) => {
              const isSelected = selectedAccount?.id === acc.id;
              const accCycle = acc.dailyCycles?.[0];
              const accDay = accCycle ? accCycle.currentDayCount : 0;
              const accCycleNo = accCycle ? accCycle.cycleNumber : 1;

              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccount(acc)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 dark:bg-amber-500/20 text-slate-900 dark:text-white shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs font-extrabold text-amber-500">{acc.accountNumber}</div>
                      <h4 className="font-bold text-xs mt-0.5 text-slate-900 dark:text-white">
                        {acc.customer?.firstName} {acc.customer?.lastName}
                      </h4>
                    </div>
                    <span className="font-mono text-xs font-extrabold text-emerald-500">
                      GHS {acc.availableBalance.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-slate-500" /> {acc.customer?.ghanaCardNumber}
                    </span>
                    <span className="font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      Cycle #{accCycleNo} • Day {accDay} / 31
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle & Right Column: Deposit/Withdrawal Processing Form */}
        {selectedAccount && (
          <div className="lg:col-span-2 space-y-6">
            
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              
              {/* Selected Account Summary Header */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Target Customer Account</span>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {selectedAccount.customer?.firstName} {selectedAccount.customer?.lastName}
                  </h3>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    Acc: {selectedAccount.accountNumber} | Ghana Card: {selectedAccount.customer?.ghanaCardNumber}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Available Bal</span>
                  <div className="text-xl font-extrabold text-emerald-500 font-mono">
                    GHS {selectedAccount.availableBalance.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Operation Selector Toggle (Deposit vs Withdrawal) */}
              <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOperationType('DEPOSIT')}
                  className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    operationType === 'DEPOSIT'
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>PHYSICAL DEPOSIT</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOperationType('WITHDRAWAL')}
                  className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    operationType === 'WITHDRAWAL'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>PHYSICAL WITHDRAWAL</span>
                </button>
              </div>

              {/* Savings Package Selection for Deposit */}
              {operationType === 'DEPOSIT' && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Coins className="w-4 h-4 text-amber-500" />
                        Choose / Switch Daily Savings Package (Ghana Cedis) *
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Client savings rate (5 to 200 GHS / day) determines multi-day payment spread
                      </p>
                    </div>

                    <span className="font-mono text-xs font-black text-amber-500 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/40 w-fit">
                      GH₵ {chosenPackage}.00 / Day
                    </span>
                  </div>

                  {/* 12 Package Buttons Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                    {SAVINGS_PACKAGES.map((pkg) => {
                      const isSelected = chosenPackage === pkg;
                      return (
                        <button
                          type="button"
                          key={pkg}
                          onClick={() => {
                            setChosenPackage(pkg);
                            // Auto-set amount to 5 days by default if previous amount matches old package
                            if (amount === '100' || amount === String(chosenPackage * 5)) {
                              setAmount(String(pkg * 5));
                            }
                          }}
                          className={`py-2 px-1 rounded-xl font-mono text-xs font-extrabold border transition-all cursor-pointer text-center ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-500/30'
                              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500/50'
                          }`}
                        >
                          GH₵ {pkg}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick-Pay Presets (1 Day, 5 Days, 10 Days, Full 30 Days) */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Quick Pay:</span>
                    {[
                      { label: '1 Day', days: 1 },
                      { label: '5 Days', days: 5 },
                      { label: '10 Days', days: 10 },
                      { label: '20 Days', days: 20 },
                      { label: 'Full 30 Days', days: 30 },
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset.days}
                        onClick={() => setAmount(String(chosenPackage * preset.days))}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:border-amber-500 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-amber-500 transition-all cursor-pointer"
                      >
                        {preset.label} (GH₵ {chosenPackage * preset.days})
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Multi-Day Splitting Preview Banner */}
                  {splitPreview && splitPreview.daysCovered > 0 && (
                    <div className="p-3 rounded-xl bg-slate-900 text-white border border-amber-500/40 space-y-1.5 text-xs shadow-inner">
                      <div className="flex items-center justify-between text-amber-400 font-bold">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          Multi-Day Automatic Spread
                        </span>
                        <span className="font-mono text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                          {splitPreview.daysCovered} Days Total
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Paying <b>GH₵ {splitPreview.totalPaid}.00</b> on the <b>GH₵ {chosenPackage}.00/day</b> package will spread across <b>Days {splitPreview.startDay} to {splitPreview.endDay}</b> of Cycle #{targetCycleNo}.
                      </p>
                      {splitPreview.remainder > 0 && (
                        <p className="text-[10px] text-amber-300 font-mono">
                          ⚠️ Remainder: GH₵ {splitPreview.remainder}.00 will remain as surplus balance.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Withdrawal Fee Settlement & Presets Banner */}
              {operationType === 'WITHDRAWAL' && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <ArrowDownLeft className="w-4 h-4 text-rose-500" />
                        Early Withdrawal & Savings Liquidation
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Withdraw accumulated savings at any time within the 31-day cycle with 1-day fee retention.
                      </p>
                    </div>

                    <span className="font-mono text-xs font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30 w-fit">
                      Net Withdrawable: GHS {selectedAccount.availableBalance.toFixed(2)}
                    </span>
                  </div>

                  {/* Net Payout Calculation Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 text-white border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">Daily Package</span>
                      <span className="font-mono font-black text-amber-400 text-sm">GH₵ {selectedAccount.savingsPackage || 20}.00 / day</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 text-white border border-slate-800">
                      <span className="text-[10px] text-rose-400 block font-medium">1-Day Retained Fee</span>
                      <span className="font-mono font-black text-rose-400 text-sm">- GH₵ {selectedAccount.savingsPackage || 20}.00</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-white">
                      <span className="text-[10px] text-emerald-300 block font-medium">Client Net Payout</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">GH₵ {selectedAccount.availableBalance.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Quick Withdrawal Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/20">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Quick Select:</span>
                    <button
                      type="button"
                      onClick={() => setAmount(String(selectedAccount.availableBalance))}
                      className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-mono font-bold text-[11px] shadow-sm hover:bg-rose-600 cursor-pointer"
                    >
                      Withdraw All (GHS {selectedAccount.availableBalance.toFixed(2)})
                    </button>
                    {selectedAccount.availableBalance >= 100 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(Math.floor(selectedAccount.availableBalance / 2)))}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:border-rose-500 cursor-pointer"
                      >
                        50% (GHS {Math.floor(selectedAccount.availableBalance / 2).toFixed(2)})
                      </button>
                    )}
                  </div>

                  {/* Fee Settlement Assurance */}
                  <div className="p-2.5 rounded-xl bg-slate-900 text-white border border-slate-800 text-[11px] flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-slate-300 leading-relaxed">
                      <b>1-Day Retained Fee Rule:</b> For instance, if a client on the <b>GH₵ 5 package</b> has deposited <b>GH₵ 25.00 (5 days)</b>, 1 day (<b>GH₵ 5.00</b>) is retained as the company fee, and <b>GH₵ 20.00 (4 days)</b> is paid out to the client.
                    </div>
                  </div>
                </div>
              )}

              {/* Form Inputs */}
              <form onSubmit={handleProcessTransaction} className="space-y-4 text-xs">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Amount (GHS) *</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">GHS</span>
                      <input
                        required
                        type="number"
                        step="1"
                        min="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-extrabold text-base focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Payment Mode *</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                      className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-amber-500"
                    >
                      <option value="PHYSICAL_CASH">Physical Cash</option>
                      <option value="MTN_MOBILE_MONEY">MTN Mobile Money (Staff Log)</option>
                      <option value="BANK_TRANSFER">Bank Transfer (Staff Log)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Teller Operational Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Over the counter physical cash transaction notes..."
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full py-3.5 rounded-xl text-white font-extrabold text-sm flex items-center justify-center space-x-2 transition-all shadow-xl cursor-pointer ${
                    operationType === 'DEPOSIT'
                      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                      : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {operationType === 'DEPOSIT'
                      ? `Confirm & Record Deposit (GH₵ ${amount} • Spread ${splitPreview?.daysCovered || 1} Days)`
                      : `Confirm & Execute Withdrawal (GH₵ ${amount})`}
                  </span>
                </button>

              </form>

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
