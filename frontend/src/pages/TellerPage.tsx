import React, { useState, useEffect } from 'react';
import { 
  getStoredAccounts, 
  saveStoredAccounts, 
  getStoredTransactions, 
  saveStoredTransactions 
} from '../services/api';
import { subscribeRealtimeEvents, broadcastRealtimeEvent } from '../services/realtimeSync';
import { Account, Transaction, PaymentMode } from '../types';
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
  RotateCcw
} from 'lucide-react';

export const TellerPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account>(accounts[0] || getStoredAccounts()[0]);
  const [operationType, setOperationType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [amount, setAmount] = useState<string>('100');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('PHYSICAL_CASH');
  const [remarks, setRemarks] = useState('');
  const [isDailyPolicyTick, setIsDailyPolicyTick] = useState<boolean>(true);
  const [printedTx, setPrintedTx] = useState<Transaction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Subscribe to real-time events from other devices/tabs
  useEffect(() => {
    const unsub = subscribeRealtimeEvents(() => {
      const freshAccs = getStoredAccounts();
      setAccounts(freshAccs);
    });
    return unsub;
  }, []);

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
  const nextDay = isCycleCompleted ? 1 : currentDay + 1;
  const targetCycleNo = isCycleCompleted ? (activeCycle ? activeCycle.cycleNumber + 1 : 1) : (activeCycle ? activeCycle.cycleNumber : 1);
  const isDay31Next = isDailyPolicyTick && nextDay === 31 && operationType === 'DEPOSIT';

  const handleProcessTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0 || !selectedAccount) return;

    const previousBal = selectedAccount.availableBalance;
    let newBal = previousBal;

    // Handle 31-Day Policy Ticking & Automatic Rollover
    if (isDailyPolicyTick && operationType === 'DEPOSIT') {
      if (isCycleCompleted || !activeCycle) {
        // Start a fresh new cycle at Day 1
        const brandNewCycle = {
          id: `cyc-${Date.now()}`,
          cycleNumber: targetCycleNo,
          currentDayCount: 1,
          dailyTargetAmount: numAmount,
          totalDeposited: numAmount,
          feeDeducted: false,
          companyFeeAmount: 0,
          isCompleted: false,
        };
        selectedAccount.dailyCycles = [brandNewCycle, ...(selectedAccount.dailyCycles || [])];
        newBal = previousBal + numAmount;
      } else {
        // Increment existing active cycle
        activeCycle.currentDayCount = nextDay;
        activeCycle.totalDeposited += numAmount;

        if (isDay31Next) {
          activeCycle.feeDeducted = true;
          activeCycle.companyFeeAmount = numAmount;
          activeCycle.isCompleted = true; // Mark cycle 31/31 complete
          newBal = previousBal; // Day 31 retained as fee
        } else {
          newBal = previousBal + numAmount;
        }
      }
    } else {
      newBal = operationType === 'DEPOSIT' ? previousBal + numAmount : previousBal - numAmount;
    }

    const updatedAcc = {
      ...selectedAccount,
      availableBalance: newBal,
      currentBalance: selectedAccount.currentBalance + (operationType === 'DEPOSIT' ? numAmount : -numAmount),
    };

    const txType = isDay31Next ? 'COMPANY_FEE_DEDUCTION' : operationType;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      referenceNo: `TX-${operationType.slice(0, 3)}-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-${Date.now().toString().slice(-8)}`,
      accountId: selectedAccount.id,
      account: updatedAcc,
      type: txType,
      paymentMode,
      amount: numAmount,
      previousBal,
      newBal,
      recordedBy: {
        id: 'user-03',
        employeeId: 'EMP-005',
        firstName: 'Abena',
        lastName: 'Osei',
        email: 'teller@erikon-group.com',
        phone: '+233 24 555 6677',
        role: 'TELLER',
        branchId: 'br-01',
      },
      remarks: isDay31Next
        ? `Teller 31-Day Policy fee retention for Day 31 (Cycle #${activeCycle?.cycleNumber || 1} Complete)`
        : isDailyPolicyTick
        ? `Teller deposit for Cycle #${targetCycleNo} Day ${nextDay}`
        : remarks || `Physical teller ${operationType.toLowerCase()} process`,
      createdAt: new Date().toISOString(),
    };

    // Update state and LocalStorage permanently
    const newAccsList = accounts.map((acc) => (acc.id === updatedAcc.id ? updatedAcc : acc));
    setAccounts(newAccsList);
    setSelectedAccount(updatedAcc);
    saveStoredAccounts(newAccsList);

    const existingTxs = getStoredTransactions();
    saveStoredTransactions([newTx, ...existingTxs]);

    // Real-time multi-device broadcast
    broadcastRealtimeEvent('DEPOSIT_RECORDED', newTx);

    setPrintedTx(newTx);
    setAmount('100');
    setRemarks('');
  };

  const handleConfirmPaid = (tx: Transaction) => {
    setSuccessMessage(
      `✅ Money Paid Successfully! GHS ${tx.amount.toFixed(2)} recorded for ${tx.account?.customer?.firstName} ${tx.account?.customer?.lastName}${
        isDailyPolicyTick ? ` (Cycle #${targetCycleNo} Day ${nextDay} of 31 recorded)` : ''
      }.`
    );
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-amber-500" />
            Teller Workstation & Cash Desk
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manual Physical Deposit, 31-Day Savings Contribution Ticking & Withdrawal Processing
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3.5 py-1.5 rounded-xl border border-emerald-500/20 text-xs font-mono font-bold">
          <ShieldAlert className="w-4 h-4" /> Vault Cash Balanced: GHS 124,800.00
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

              {/* 31-Day Policy Day Ticking Card for Teller */}
              {operationType === 'DEPOSIT' && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDailyPolicyTick}
                        onChange={(e) => setIsDailyPolicyTick(e.target.checked)}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                      />
                      <span className="font-extrabold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <CalendarCheck className="w-4 h-4" />
                        Tick as 31-Day Policy Daily Contribution
                      </span>
                    </label>

                    {isDailyPolicyTick && (
                      <span className="font-mono font-extrabold text-amber-500 text-xs bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/40">
                        {isCycleCompleted ? `Starting Cycle #${targetCycleNo} Day 1` : `Cycle #${targetCycleNo} • Day ${nextDay} of 31`}
                      </span>
                    )}
                  </div>

                  {isDailyPolicyTick && (
                    <div className="text-[11px] text-slate-600 dark:text-amber-200 leading-relaxed font-sans pt-1 border-t border-amber-500/20">
                      {isCycleCompleted ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold">
                          <RotateCcw className="w-4 h-4" />
                          Previous Cycle completed! This payment starts fresh **Cycle #{targetCycleNo} at Day 1**.
                        </div>
                      ) : (
                        <span>Ticking this box marks **Day {nextDay}** as paid for {selectedAccount.customer?.firstName}'s Cycle #{targetCycleNo}.</span>
                      )}

                      {isDay31Next && (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md">
                          <Sparkles className="w-4 h-4 shrink-0" />
                          DAY 31 NOTICE: This 31st deposit (GHS {amount}) will be retained as E-RIKON management fee. The next payment will automatically start Cycle #{targetCycleNo + 1} (Days 1–30).
                        </div>
                      )}
                    </div>
                  )}
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
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-extrabold text-base focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Payment Mode *</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                      className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none"
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
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
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
                    {isDailyPolicyTick && operationType === 'DEPOSIT'
                      ? `Confirm & Record Cycle #${targetCycleNo} Day ${nextDay} (GHS ${amount})`
                      : `Confirm & Execute ${operationType}`}
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
