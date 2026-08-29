import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  getStoredAccounts, 
  saveStoredAccounts, 
  getStoredTransactions, 
  saveStoredTransactions,
  accumulateCompanyInterest,
  recordPackageDeposit,
  splitPaymentIntoDays,
  getMaxWithdrawableLoan,
  getStoredCompanyInterest,
  getStoredCompanyWithdrawals,
  toDecimal
} from '../services/api';
import { useRealtimeSync, broadcastRealtimeEvent } from '../services/realtimeSync';
import { pushLocalToCloud } from '../services/cloudSync';
import { Account, Transaction, PaymentMode, SavingsPackage, SAVINGS_PACKAGES, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
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
  Coins,
  ShieldCheck,
  UserPlus,
  Users
} from 'lucide-react';

export const TellerPage: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(() => {
    const accs = getStoredAccounts();
    return accs.length > 0 ? accs[0] : null;
  });
  const [operationType, setOperationType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [amount, setAmount] = useState<string>('100');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('PHYSICAL_CASH');
  const [remarks, setRemarks] = useState('');
  const [chosenPackage, setChosenPackage] = useState<SavingsPackage>(selectedAccount?.savingsPackage || 20);
  const [isDailyPolicyTick, setIsDailyPolicyTick] = useState<boolean>(true);
  const [printedTx, setPrintedTx] = useState<Transaction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-select first account if none currently selected
  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) {
      setSelectedAccount(accounts[0]);
      if (accounts[0].savingsPackage) setChosenPackage(accounts[0].savingsPackage);
    }
  }, [accounts, selectedAccount]);

  // Handle incoming routing state (e.g. when navigated from Customers, Accounts, or Dashboard)
  useEffect(() => {
    if (location.state) {
      const stateObj = location.state as { accountId?: string; mode?: 'DEPOSIT' | 'WITHDRAWAL' };
      if (stateObj.accountId) {
        const found = accounts.find((a) => a.id === stateObj.accountId);
        if (found) {
          setSelectedAccount(found);
          if (found.savingsPackage) setChosenPackage(found.savingsPackage);
        }
      }
      if (stateObj.mode) {
        setOperationType(stateObj.mode);
      }
    }
  }, [location.state, accounts]);

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
      else if (freshAccs.length > 0) setSelectedAccount(freshAccs[0]);
    } else if (freshAccs.length > 0) {
      setSelectedAccount(freshAccs[0]);
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

  const activeCycle = selectedAccount?.dailyCycles?.[0];
  const currentDay = activeCycle ? activeCycle.currentDayCount : 0;
  const isCycleCompleted = currentDay >= 31;
  const targetCycleNo = isCycleCompleted ? (activeCycle ? activeCycle.cycleNumber + 1 : 1) : (activeCycle ? activeCycle.cycleNumber : 1);

  const numAmount = Number(amount) || 0;
  const splitPreview = numAmount > 0 ? splitPaymentIntoDays(chosenPackage, numAmount, isCycleCompleted ? 0 : currentDay) : null;
  const loanInfo = selectedAccount ? getMaxWithdrawableLoan(selectedAccount) : { maxLoanAmount: 0, protectedRetentionFee: 0, canBorrow: false, activeCycleDay: 0 };

  const handleProcessTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0 || !selectedAccount) return;

    const tellerUser: User = currentUser || {
      id: 'staff-active',
      employeeId: 'EMP-OFFICER',
      firstName: 'Authorized',
      lastName: 'Teller',
      email: 'teller@erikon.com',
      phone: '0240000000',
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
        remarks || `Teller deposit on GH₵ ${chosenPackage}/day package`,
        undefined,
        chosenPackage
      );

      setSelectedAccount(updatedAccount);
      setAccounts(getStoredAccounts());
      setPrintedTx(transaction);
      broadcastRealtimeEvent('PACKAGE_DEPOSIT_RECORDED', { accountId: selectedAccount.id, amount: numAmount });
      pushLocalToCloud().catch(() => {});

      setSuccessMessage(
        `🎉 Deposit of GHS ${numAmount.toFixed(2)} recorded! Covered ${splitResult.daysCovered} days (Days ${splitResult.startDay} to ${splitResult.endDay}) on GH₵ ${chosenPackage}/day package.`
      );
    } else {
      // Withdrawal as Savings-Backed Loan (Safeguards the 1-day retention fee)
      if (numAmount > loanInfo.maxLoanAmount) {
        alert(
          `❌ Withdrawal/Loan exceeds allowable limit!\n\n` +
          `• Total Savings Balance: GH₵ ${selectedAccount.availableBalance.toFixed(2)}\n` +
          `• Protected 1-Day Retention Fee: GH₵ ${loanInfo.protectedRetentionFee.toFixed(2)}\n` +
          `• Maximum Allowable Withdrawal Loan: GH₵ ${loanInfo.maxLoanAmount.toFixed(2)}\n\n` +
          `The company 1-day retention fee is safeguarded and cannot be eaten into.`
        );
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
        remarks: remarks || `Withdrawal loan against savings (Protected fee: GH₵ ${loanInfo.protectedRetentionFee.toFixed(2)})`,
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
      pushLocalToCloud().catch(() => {});

      setSuccessMessage(`✅ Savings-backed withdrawal loan of GHS ${numAmount.toFixed(2)} completed successfully!`);
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

  const todayIso = new Date().toISOString().split('T')[0];
  const allTxs = getStoredTransactions();
  const todayTellerDeposits = allTxs
    .filter((t) => (t.type === 'DEPOSIT' || t.type === 'COMPANY_FEE_DEDUCTION') && t.createdAt?.startsWith(todayIso))
    .reduce((sum, t) => sum + t.amount, 0);
  const todayTellerWithdrawals = allTxs
    .filter((t) => t.type === 'WITHDRAWAL' && t.createdAt?.startsWith(todayIso))
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Total authoritative cash in vault across all client savings balances + corporate retained interest
  const totalClientSavings = accounts.reduce((sum, a) => sum + (a.availableBalance || 0), 0);
  const totalCompanyInterest = getStoredCompanyInterest().reduce((sum, r) => sum + (r.accumulatedAmount || 0), 0);
  const totalApprovedInterestWithdrawals = getStoredCompanyWithdrawals()
    .filter((w) => w.status === 'APPROVED')
    .reduce((sum, w) => sum + w.amount, 0);
  const totalVaultLiquidity = totalClientSavings + Math.max(0, totalCompanyInterest - totalApprovedInterestWithdrawals);

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

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto justify-start sm:justify-end shrink-0">
          {currentUser && (
            <div className="flex items-center space-x-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-xl border border-amber-500/30 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Officer: <b>{currentUser.firstName} {currentUser.lastName}</b> ({currentUser.role.replace(/_/g, ' ')})</span>
            </div>
          )}
          <div className="flex items-center space-x-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-xs font-mono font-bold w-fit shrink-0 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" /> 
            <span>Vault Cash Position: GHS {totalVaultLiquidity.toFixed(2)}</span>
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
            {filteredAccounts.length === 0 ? (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-extrabold text-xs text-slate-900 dark:text-white">
                    {searchTerm ? 'No Matching Clients' : 'No Clients Found'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {searchTerm
                      ? `No account matches "${searchTerm}".`
                      : 'Onboard a customer to open their savings scheme.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/customers')}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register Customer</span>
                </button>
              </div>
            ) : (
              filteredAccounts.map((acc) => {
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
              })
            )}
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
                  onClick={() => {
                    setOperationType('DEPOSIT');
                    if (!amount || Number(amount) <= 0) {
                      setAmount(String(chosenPackage * 5));
                    }
                  }}
                  className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    operationType === 'DEPOSIT'
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>PHYSICAL DEPOSIT</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOperationType('WITHDRAWAL');
                    if (loanInfo.maxLoanAmount > 0 && (Number(amount) > loanInfo.maxLoanAmount || Number(amount) <= 0)) {
                      setAmount(String(Math.min(100, loanInfo.maxLoanAmount)));
                    }
                  }}
                  className={`py-3 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    operationType === 'WITHDRAWAL'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/30'
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

              {/* Withdrawal as Savings-Backed Loan Fee Settlement & Presets Banner */}
              {operationType === 'WITHDRAWAL' && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <ArrowDownLeft className="w-4 h-4 text-rose-500" />
                        Withdrawal as Savings-Backed Loan (30-Day Cycle)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Withdrawals are disbursed as loans against client savings. The 1-day retention fee is safeguarded for Day 31.
                      </p>
                    </div>

                    <span className="font-mono text-xs font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30 w-fit">
                      Max Loan Withdrawable: GHS {loanInfo.maxLoanAmount.toFixed(2)}
                    </span>
                  </div>

                  {/* Net Payout Calculation Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 text-white border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">Total Savings Balance</span>
                      <span className="font-mono font-black text-amber-400 text-sm">GH₵ {selectedAccount.availableBalance.toFixed(2)}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 text-white border border-slate-800">
                      <span className="text-[10px] text-rose-400 block font-medium">Protected 1-Day Fee</span>
                      <span className="font-mono font-black text-rose-400 text-sm">- GH₵ {loanInfo.protectedRetentionFee.toFixed(2)}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-white">
                      <span className="text-[10px] text-emerald-300 block font-medium">Max Loan Available</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">GH₵ {loanInfo.maxLoanAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Quick Withdrawal Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/20">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Quick Select:</span>
                    <button
                      type="button"
                      disabled={loanInfo.maxLoanAmount <= 0}
                      onClick={() => setAmount(String(loanInfo.maxLoanAmount))}
                      className="px-2.5 py-1 rounded-lg bg-rose-500 disabled:opacity-50 text-white font-mono font-bold text-[11px] shadow-sm hover:bg-rose-600 cursor-pointer"
                    >
                      Max Allowable Loan (GHS {loanInfo.maxLoanAmount.toFixed(2)})
                    </button>
                    {loanInfo.maxLoanAmount >= 100 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(Math.floor(loanInfo.maxLoanAmount / 2)))}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:border-rose-500 cursor-pointer"
                      >
                        50% (GHS {Math.floor(loanInfo.maxLoanAmount / 2).toFixed(2)})
                      </button>
                    )}
                  </div>

                  {/* Fee Settlement Assurance */}
                  <div className="p-2.5 rounded-xl bg-slate-900 text-white border border-slate-800 text-[11px] flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-slate-300 leading-relaxed">
                      <b>Retention Protection Rule:</b> When a client withdraws early as a loan against their savings, the 1-day retention fee (<b>GH₵ {loanInfo.protectedRetentionFee.toFixed(2)}</b>) is never eaten into and remains safely reserved in the vault.
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

        {/* Right Column Empty State when No Client Account is Selected */}
        {!selectedAccount && (
          <div className="lg:col-span-2 p-8 sm:p-14 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-5 my-auto">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto shadow-md">
              <Landmark className="w-10 h-10" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {accounts.length === 0 ? 'No Client Accounts Available' : 'Select a Customer to Begin'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {accounts.length === 0
                  ? 'No customer savings accounts are currently loaded. Register a new customer with Ghana Card to immediately start recording deposits and processing withdrawals.'
                  : 'Click any client from the directory on the left to view their 31-day contribution cycle, choose savings packages, and record cash deposits or withdrawal loans.'}
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/customers')}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs inline-flex items-center gap-2 shadow-xl shadow-amber-500/20 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <UserPlus className="w-4 h-4" />
                <span>Onboard / Register Client Account</span>
              </button>
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
