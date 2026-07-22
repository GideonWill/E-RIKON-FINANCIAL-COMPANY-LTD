import React, { useState } from 'react';
import { 
  getStoredAccounts, 
  saveStoredAccounts, 
  getStoredTransactions, 
  saveStoredTransactions 
} from '../services/api';
import { Account, Transaction } from '../types';
import { ReceiptPrinterModal } from '../components/ui/ReceiptPrinterModal';
import { 
  Smartphone, 
  UserPlus, 
  Search, 
  CalendarCheck, 
  CheckCircle2, 
  ArrowUpRight, 
  Sparkles, 
  MapPin, 
  Target,
  RotateCcw
} from 'lucide-react';

export const FieldOfficerPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [selectedAccount, setSelectedAccount] = useState<Account>(accounts[0] || getStoredAccounts()[0]);
  const [dailyAmount, setDailyAmount] = useState<string>('100');
  const [fieldRemarks, setFieldRemarks] = useState('');
  const [printedTx, setPrintedTx] = useState<Transaction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeCycle = selectedAccount?.dailyCycles?.[0];
  const currentDay = activeCycle ? activeCycle.currentDayCount : 0;
  const isCycleCompleted = currentDay >= 31;
  const nextDay = isCycleCompleted ? 1 : currentDay + 1;
  const targetCycleNo = isCycleCompleted ? (activeCycle ? activeCycle.cycleNumber + 1 : 1) : (activeCycle ? activeCycle.cycleNumber : 1);
  const isDay31Next = nextDay === 31;

  const handleRecordCollection = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(dailyAmount);
    if (!numAmount || numAmount <= 0 || !selectedAccount) return;

    const previousBal = selectedAccount.availableBalance;
    let newAvailable = previousBal;

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
      newAvailable = previousBal + numAmount;
    } else {
      activeCycle.currentDayCount = nextDay;
      activeCycle.totalDeposited += numAmount;

      if (isDay31Next) {
        activeCycle.feeDeducted = true;
        activeCycle.companyFeeAmount = numAmount;
        activeCycle.isCompleted = true; // Mark 31/31 complete
        newAvailable = previousBal; // Day 31 fee retained
      } else {
        newAvailable = previousBal + numAmount;
      }
    }

    const updatedAcc = {
      ...selectedAccount,
      availableBalance: newAvailable,
      currentBalance: selectedAccount.currentBalance + numAmount,
    };

    const newTx: Transaction = {
      id: `tx-field-${Date.now()}`,
      referenceNo: `TX-FLD-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-FLD-${Date.now().toString().slice(-8)}`,
      accountId: selectedAccount.id,
      account: updatedAcc,
      type: isDay31Next ? 'COMPANY_FEE_DEDUCTION' : 'DEPOSIT',
      paymentMode: 'PHYSICAL_CASH',
      amount: numAmount,
      previousBal,
      newBal: newAvailable,
      recordedBy: {
        id: 'user-04',
        employeeId: 'EMP-009',
        firstName: 'Kofi',
        lastName: 'Appiah',
        email: 'field.officer@erikon-group.com',
        phone: '+233 24 999 8877',
        role: 'FIELD_OFFICER',
        branchId: 'br-01',
      },
      remarks: isDay31Next
        ? `E-RIKON 31-Day Policy management fee retention for Day 31 (Cycle #${activeCycle?.cycleNumber || 1} Complete)`
        : fieldRemarks || `Daily collection contribution for Cycle #${targetCycleNo} Day ${nextDay}`,
      createdAt: new Date().toISOString(),
    };

    // Save to LocalStorage permanently
    const newAccsList = accounts.map((acc) => (acc.id === updatedAcc.id ? updatedAcc : acc));
    setAccounts(newAccsList);
    setSelectedAccount(updatedAcc);
    saveStoredAccounts(newAccsList);

    const existingTxs = getStoredTransactions();
    saveStoredTransactions([newTx, ...existingTxs]);

    setPrintedTx(newTx);
    setFieldRemarks('');
  };

  const handleConfirmPaid = (tx: Transaction) => {
    setSuccessMessage(
      `✅ Money Paid Successfully! GHS ${tx.amount.toFixed(2)} collected for ${tx.account?.customer?.firstName} ${tx.account?.customer?.lastName} (Cycle #${targetCycleNo} Day ${nextDay} recorded).`
    );
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-amber-500" />
            Field Collection Desk (31-Day Policy)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Mobile Onsite Customer Daily Savings Collections & Automatic Cycle Rollover
          </p>
        </div>

        {/* Daily Field Target Card */}
        <div className="flex items-center space-x-3 bg-slate-900 text-white p-3 rounded-2xl border border-slate-800">
          <Target className="w-5 h-5 text-amber-400" />
          <div className="text-xs font-mono">
            <div className="text-[10px] text-slate-400 uppercase">Today's Route Target</div>
            <div className="font-bold text-amber-400">GHS 4,500.00 (78% Achieved)</div>
          </div>
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
        
        {/* Left Column: Assigned Field Route Customers */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Route Clients</h3>
          {accounts.map((acc) => {
            const isSelected = selectedAccount?.id === acc.id;
            const accCycle = acc.dailyCycles?.[0];
            const currentCount = accCycle ? accCycle.currentDayCount : 0;
            const accCycleNo = accCycle ? accCycle.cycleNumber : 1;

            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-500/20 to-slate-900 border-amber-500 text-slate-900 dark:text-white shadow-lg ring-2 ring-amber-500/30'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs">
                    {acc.customer?.firstName} {acc.customer?.lastName}
                  </h4>
                  <span className="font-mono text-xs font-bold text-amber-500">
                    Cycle #{accCycleNo} • Day {currentCount} / 31
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-500" /> {acc.customer?.address}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Onsite Collection Form & 31-Day Policy Indicator */}
        {selectedAccount && (
          <div className="lg:col-span-2 space-y-6">
            
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              
              {/* Target Client Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">ONSITE FIELD ENTRY</span>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {selectedAccount.customer?.firstName} {selectedAccount.customer?.lastName}
                  </h3>
                  <div className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-0.5">
                    Phone: {selectedAccount.customer?.phone} | Ghana Card: {selectedAccount.customer?.ghanaCardNumber}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Next Contribution</span>
                  <div className="text-xl font-extrabold text-amber-500 font-mono">
                    {isCycleCompleted ? `Cycle #${targetCycleNo} Day 1` : `Cycle #${targetCycleNo} Day ${nextDay} / 31`}
                  </div>
                </div>
              </div>

              {/* Cycle Rollover Alert Banner */}
              {isCycleCompleted ? (
                <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-xs space-y-1">
                  <div className="font-extrabold text-sm flex items-center gap-1.5 text-emerald-400">
                    <RotateCcw className="w-4 h-4" /> CYCLE #{targetCycleNo - 1} COMPLETED (31/31)
                  </div>
                  <p>
                    Previous 31-day cycle completed and fee retained. This deposit starts fresh **Cycle #{targetCycleNo} at Day 1**. Accumulated savings remain safe.
                  </p>
                </div>
              ) : isDay31Next ? (
                <div className="p-4 rounded-2xl bg-amber-500 text-slate-950 font-semibold text-xs space-y-1 shadow-lg">
                  <div className="font-extrabold text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> DAY 31 E-RIKON COMPANY FEE RETENTION NOTICE
                  </div>
                  <p>
                    This is the 31st deposit in Cycle #{targetCycleNo}. Per company policy, this 1-day deposit (GHS {dailyAmount}) will be retained as management fee, closing Cycle #{targetCycleNo} and rolling over to Cycle #{targetCycleNo + 1}!
                  </p>
                </div>
              ) : null}

              {/* Collection Form */}
              <form onSubmit={handleRecordCollection} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Daily Cash Contribution (GHS) *</label>
                  <input
                    required
                    type="number"
                    step="1"
                    value={dailyAmount}
                    onChange={(e) => setDailyAmount(e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-extrabold text-base focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Onsite Field Remarks</label>
                  <input
                    type="text"
                    value={fieldRemarks}
                    onChange={(e) => setFieldRemarks(e.target.value)}
                    placeholder="Onsite client collection notes..."
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm flex items-center justify-center space-x-2 transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {isCycleCompleted
                      ? `Start Cycle #${targetCycleNo} Day 1 Collection & Issue Receipt`
                      : `Record Cycle #${targetCycleNo} Day ${nextDay} Collection & Issue Receipt`}
                  </span>
                </button>
              </form>

            </div>

          </div>
        )}

      </div>

      {/* Field Receipt Modal */}
      <ReceiptPrinterModal
        transaction={printedTx}
        onClose={() => setPrintedTx(null)}
        onConfirmPaid={handleConfirmPaid}
      />

    </div>
  );
};
