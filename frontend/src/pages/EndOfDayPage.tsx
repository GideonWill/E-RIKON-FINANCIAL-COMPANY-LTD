import React, { useState, useMemo } from 'react';
import { 
  getStoredTransactions, 
  getStoredLoans, 
  getStoredAccounts, 
  getStoredApprovals,
  getStoredCompanyInterest,
  getStoredAuditLogs,
  getRegisteredUsers,
  clearStoredTransactions
} from '../services/api';
import { pushLocalToCloud } from '../services/cloudSync';
import { useRealtimeSync } from '../services/realtimeSync';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, LoanApplication, Account, ApprovalRequest, AuditLog } from '../types';
import logoImg from '../assets/logo.png';
import { 
  CalendarCheck2, 
  Landmark, 
  Smartphone, 
  Calculator, 
  ShieldCheck, 
  PiggyBank, 
  Clock, 
  Download, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Users, 
  CheckCircle2, 
  Calendar, 
  Filter, 
  Building2,
  FileSpreadsheet,
  BadgeCheck,
  Search,
  DollarSign,
  Trash2
} from 'lucide-react';

export const EndOfDayPage: React.FC = () => {
  const { currentUser } = useAuth();
  
  // Real-time state
  const [transactions, setTransactions] = useState<Transaction[]>(getStoredTransactions());
  const [loans, setLoans] = useState<LoanApplication[]>(getStoredLoans());
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(getStoredApprovals());
  const [companyInterest, setCompanyInterest] = useState(getStoredCompanyInterest());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(getStoredAuditLogs());
  const [registeredStaff, setRegisteredStaff] = useState(getRegisteredUsers());

  // Subscribe to real-time events
  useRealtimeSync(() => {
    setTransactions(getStoredTransactions());
    setLoans(getStoredLoans());
    setAccounts(getStoredAccounts());
    setApprovals(getStoredApprovals());
    setCompanyInterest(getStoredCompanyInterest());
    setAuditLogs(getStoredAuditLogs());
    setRegisteredStaff(getRegisteredUsers());
  });

  // Today's ISO Date String (YYYY-MM-DD)
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [activeTab, setActiveTab] = useState<'ALL' | 'TELLER' | 'FIELD' | 'LOANS' | 'INTEREST' | 'APPROVALS' | 'AUDIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isEodPdfModalOpen, setIsEodPdfModalOpen] = useState<boolean>(false);
  const [eodSignoffDone, setEodSignoffDone] = useState<boolean>(false);

  // Filter transactions for the selected operating date
  const dayTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchDate = t.createdAt ? t.createdAt.startsWith(selectedDate) : false;
      return matchDate;
    });
  }, [transactions, selectedDate]);

  // Helper: Accurately resolve exact recording officer for a daily split without depending on logged-in viewer
  const getOfficerNameForSplit = (split: any, acc: Account): string => {
    if (split.recordedBy && split.recordedBy.trim() !== '' && split.recordedBy !== 'Authorized Officer') {
      return split.recordedBy;
    }
    if (split.batchTxRef) {
      const match = transactions.find((t) => t.referenceNo === split.batchTxRef);
      if (match?.recordedBy?.firstName && match.recordedBy.firstName !== 'Authorized') {
        const role = (match.recordedBy.role || 'SUPER_ADMIN').replace(/_/g, ' ');
        return `${match.recordedBy.firstName} ${match.recordedBy.lastName} (${role})`;
      }
    }
    const accTx = transactions.find((t) => t.accountId === acc.id);
    if (accTx?.recordedBy?.firstName && accTx.recordedBy.firstName !== 'Authorized') {
      const role = (accTx.recordedBy.role || 'SUPER_ADMIN').replace(/_/g, ' ');
      return `${accTx.recordedBy.firstName} ${accTx.recordedBy.lastName} (${role})`;
    }
    return 'Gideon Ogunu (SUPER ADMIN)';
  };

  // Daily field splits recorded across all client cycles for this date
  const dayFieldSplits = useMemo(() => {
    const splits: { 
      splitDate: string; 
      amount: number; 
      dayNumber: number; 
      receiptNo: string; 
      customerName: string; 
      accountNumber: string; 
      savingsPackage: number; 
      recordedBy?: string;
      recordedAt?: string;
      isCompanyFee: boolean;
      currentCycleDay: number;
      totalCoveredDays: number;
    }[] = [];

    accounts.forEach((acc) => {
      (acc.dailyCycles || []).forEach((c) => {
        const cycleSplits = c.dailySplits || [];
        const activeDayCount = Math.max(c.currentDayCount, cycleSplits.length);

        // Check if any split in this cycle matches the selected date (or was recorded on/prior for this active batch)
        const hasMatch = cycleSplits.some((s) => {
          const wasRecordedOnDate = s.recordedAt ? s.recordedAt.startsWith(selectedDate) : false;
          const isDateMatch = s.date === selectedDate;
          const isCycleStartedOnDate = c.startDate ? c.startDate.startsWith(selectedDate) : false;
          return wasRecordedOnDate || isDateMatch || isCycleStartedOnDate;
        });

        if (hasMatch) {
          cycleSplits.forEach((s) => {
            splits.push({
              splitDate: s.date,
              amount: s.amount,
              dayNumber: s.dayNumber,
              receiptNo: s.receiptNo || '—',
              customerName: acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : 'Kwame Djan',
              accountNumber: acc.accountNumber,
              savingsPackage: acc.savingsPackage || 20,
              recordedBy: getOfficerNameForSplit(s, acc),
              recordedAt: s.recordedAt,
              isCompanyFee: Boolean(s.isCompanyFee),
              currentCycleDay: activeDayCount,
              totalCoveredDays: cycleSplits.length,
            });
          });
        }
      });
    });
    return splits;
  }, [accounts, selectedDate, transactions]);

  // Loans created / updated on the selected date
  const dayLoans = useMemo(() => {
    return loans.filter((l) => {
      return l.createdAt ? l.createdAt.startsWith(selectedDate) : false;
    });
  }, [loans, selectedDate]);

  // Approvals reviewed on the selected date
  const dayApprovals = useMemo(() => {
    return approvals.filter((a) => {
      const isDate = (a.reviewedAt && a.reviewedAt.startsWith(selectedDate)) || (a.createdAt && a.createdAt.startsWith(selectedDate));
      return isDate;
    });
  }, [approvals, selectedDate]);

  // Company interest accumulated or deducted on this date
  const dayCompanyInterest = useMemo(() => {
    return companyInterest.filter((ci) => {
      return ci.createdAt ? ci.createdAt.startsWith(selectedDate) : false;
    });
  }, [companyInterest, selectedDate]);

  // Audit events timestamped on this date
  const dayAuditLogs = useMemo(() => {
    return auditLogs.filter((al) => {
      return al.createdAt ? al.createdAt.startsWith(selectedDate) : false;
    });
  }, [auditLogs, selectedDate]);

  // ================= CALCULATION OF ROLE-BY-ROLE TOTALS ================= //

  // 1. Teller & Counter Operations
  const tellerDeposits = dayTransactions
    .filter((t) => t.type === 'DEPOSIT' && t.paymentMode === 'PHYSICAL_CASH')
    .reduce((sum, t) => sum + t.amount, 0);

  const tellerWithdrawals = dayTransactions
    .filter((t) => t.type === 'WITHDRAWAL')
    .reduce((sum, t) => sum + t.amount, 0);

  const tellerElectronicInflow = dayTransactions
    .filter((t) => t.type === 'DEPOSIT' && t.paymentMode !== 'PHYSICAL_CASH')
    .reduce((sum, t) => sum + t.amount, 0);

  // 2. Field Collections & Multi-Day Splitter
  const fieldCollectionsTotal = dayFieldSplits
    .filter((s) => !s.isCompanyFee)
    .reduce((sum, s) => sum + s.amount, 0);

  // 3. Loan Desk Operations
  const loansDisbursedTotal = dayTransactions
    .filter((t) => t.type === 'LOAN_DISBURSEMENT')
    .reduce((sum, t) => sum + t.amount, 0);

  const loanRepaymentsTotal = dayTransactions
    .filter((t) => t.type === 'LOAN_REPAYMENT')
    .reduce((sum, t) => sum + t.amount, 0);

  // 4. Company 31-Day Retained Fees (Unified with getStoredCompanyInterest)
  const totalCompanyInterestAccumulated = companyInterest
    .reduce((sum, ci) => sum + (ci.accumulatedAmount || 0), 0);

  const companyRetainedFeesToday = companyInterest
    .filter((ci) => ci.createdAt && ci.createdAt.startsWith(selectedDate))
    .reduce((sum, ci) => sum + (ci.accumulatedAmount || 0), 0);

  // 5. Total Daily Inflow & Outflow Across Whole Institution
  const totalDailyInflow = Math.max(tellerDeposits + tellerElectronicInflow, fieldCollectionsTotal) + loanRepaymentsTotal;
  const totalDailyOutflow = tellerWithdrawals + loansDisbursedTotal;
  const netDailyCashPosition = totalDailyInflow - totalDailyOutflow;

  // Formatted date string
  const formattedSelectedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return dateObj.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Helper: Accurately resolve exact customer name for a transaction
  const getCustomerNameForTx = (tx: Transaction): string => {
    if (tx.account?.customer?.firstName) {
      return `${tx.account.customer.firstName} ${tx.account.customer.lastName}`;
    }
    const foundAcc = accounts.find((a) => a.id === tx.accountId || a.accountNumber === tx.account?.accountNumber);
    if (foundAcc?.customer?.firstName) {
      return `${foundAcc.customer.firstName} ${foundAcc.customer.lastName}`;
    }
    return 'Client';
  };

  // Helper: Accurately resolve exact recording officer name for a transaction
  const getOfficerNameForTx = (tx: Transaction): string => {
    if (tx.recordedBy?.firstName && tx.recordedBy.firstName !== 'Authorized') {
      const role = (tx.recordedBy.role || 'SUPER_ADMIN').replace(/_/g, ' ');
      return `${tx.recordedBy.firstName} ${tx.recordedBy.lastName} (${role})`;
    }
    return 'Gideon Ogunu (SUPER ADMIN)';
  };

  // Export CSV of End of Day Reconciliation
  const exportEodCsv = () => {
    const separator = ',';
    const rows = [
      ['E-RiKON Financial Company PLC - End of Day (EOD) Operations Summary'],
      ['Operating Date', formattedSelectedDate],
      ['Generated At', new Date().toLocaleString('en-GB')],
      ['Authorized Workstation', `${currentUser?.firstName || 'Gideon'} ${currentUser?.lastName || 'Ogunu'} (${currentUser?.role || 'SUPER_ADMIN'})`],
      [''],
      ['EXECUTIVE CASH POSITION SUMMARY', 'AMOUNT (GHS)'],
      ['Total Physical Teller Deposits', tellerDeposits.toFixed(2)],
      ['Total Mobile Money / Electronic Deposits', tellerElectronicInflow.toFixed(2)],
      ['Total Field Collections (Daily Splitter)', fieldCollectionsTotal.toFixed(2)],
      ['Total Loan Repayments Collected', loanRepaymentsTotal.toFixed(2)],
      ['TOTAL INSTITUTIONAL INFLOW', totalDailyInflow.toFixed(2)],
      ['Total Customer Withdrawals Paid Out', tellerWithdrawals.toFixed(2)],
      ['Total Loan Disbursements Issued', loansDisbursedTotal.toFixed(2)],
      ['TOTAL INSTITUTIONAL OUTFLOW', totalDailyOutflow.toFixed(2)],
      ['NET DAILY CASH SURPLUS / VARIANCE', netDailyCashPosition.toFixed(2)],
      ['Company 31-Day Management Fee Retained', companyRetainedFeesToday.toFixed(2)],
      [''],
      ['ITEMIZED TRANSACTIONS OF THE DAY'],
      ['Receipt No', 'Ref No', 'Type', 'Amount (GHS)', 'Payment Mode', 'Customer', 'Account No', 'Timestamp', 'Cashier/Agent'],
      ...dayTransactions.map((t) => [
        t.receiptNo || '—',
        t.referenceNo || '—',
        t.type,
        t.amount.toFixed(2),
        t.paymentMode || 'Physical Cash',
        `"${getCustomerNameForTx(t)}"`,
        t.account?.accountNumber || '—',
        t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
        `"${getOfficerNameForTx(t)}"`,
      ]),
    ];

    const csvContent = rows.map((r) => r.join(separator)).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `E-RIKON_End_of_Day_Summary_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header & Date Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-2xl bg-teal-50 text-[#0d9488] border border-teal-200">
              <CalendarCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                End of Day (EOD) Operations & Cash Balancing
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional Daily Close • Multi-Role Reconciliation across Tellers, Field Officers, Loan Officers & Super Admin
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Date Picker */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Quick Date Buttons */}
          <button
            type="button"
            onClick={() => setSelectedDate(todayIso)}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              selectedDate === todayIso
                ? 'bg-[#0d9488] text-white shadow-md shadow-teal-900/20'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Today's Live Close
          </button>

          {/* Date Picker Input */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs shadow-2xs">
            <Calendar className="w-4 h-4 text-[#0d9488]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer font-mono"
            />
          </div>

          {/* Print/Download Official EOD PDF */}
          <button
            type="button"
            onClick={() => setIsEodPdfModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#0a3866] hover:bg-[#082d52] text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-slate-900/10 cursor-pointer transition-all"
            title="Download/Print Official End of Day Balancing Statement"
          >
            <Printer className="w-4 h-4" />
            <span>Print EOD Summary</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={exportEodCsv}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          {currentUser?.role === 'SUPER_ADMIN' && transactions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all recorded transactions from the ledger?')) {
                  clearStoredTransactions();
                  setTransactions([]);
                  pushLocalToCloud().catch(() => {});
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="Clear all transactions from the system"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Ledger</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-[#0a3866] via-[#0d9488] to-[#166534] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-teal-950/10">
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-teal-200">
            Selected Operating Day
          </span>
          <div className="text-lg font-black tracking-tight">{formattedSelectedDate}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-left sm:text-right">
            <span className="text-[10px] font-mono text-teal-200 block uppercase">Reconciliation Status</span>
            <span className="text-xs font-black text-white bg-white/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border border-white/20">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>{eodSignoffDone ? 'Day Closed & Certified' : 'Live Operating Session Active'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Executive Daily Key Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Inflow */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">Total Daily Inflow</span>
            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            GHS {totalDailyInflow.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            Tellers ({tellerDeposits.toFixed(2)}) + Field ({fieldCollectionsTotal.toFixed(2)}) + Loans ({loanRepaymentsTotal.toFixed(2)})
          </p>
        </div>

        {/* Total Outflow */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">Total Daily Outflow</span>
            <div className="p-1.5 rounded-xl bg-rose-50 text-rose-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            GHS {totalDailyOutflow.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            Withdrawals ({tellerWithdrawals.toFixed(2)}) + Loan Disbursements ({loansDisbursedTotal.toFixed(2)})
          </p>
        </div>

        {/* Net Cash Position */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">Net Daily Cash Variance</span>
            <div className="p-1.5 rounded-xl bg-teal-50 text-[#0d9488]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-black font-mono ${netDailyCashPosition >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            GHS {netDailyCashPosition.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {netDailyCashPosition >= 0 ? 'Cash Surplus In Till & Vault' : 'Net Cash Disbursed'}
          </p>
        </div>

        {/* Company Day-31 Fee Retained / Company Interest Piled Up */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">Company Interest Piled Up</span>
            <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            GHS {totalCompanyInterestAccumulated.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            30-Day Member Retention • Today: GHS {companyRetainedFeesToday.toFixed(2)}
          </p>
        </div>

      </div>

      {/* Role Tabs Navigation */}
      <div className="flex items-center space-x-1.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-2">
        {[
          { id: 'ALL', label: 'All Roles Overview', icon: Users },
          { id: 'TELLER', label: `Tellers (${dayTransactions.length})`, icon: Landmark },
          { id: 'FIELD', label: `Field Officers (${dayFieldSplits.length})`, icon: Smartphone },
          { id: 'LOANS', label: `Loans Desk (${dayLoans.length})`, icon: Calculator },
          { id: 'APPROVALS', label: `Super Admin Approvals (${dayApprovals.length})`, icon: ShieldCheck },
          { id: 'AUDIT', label: `Security Logs (${dayAuditLogs.length})`, icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-[#0d9488] to-[#166534] text-white shadow-md shadow-teal-900/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= PANEL 1: ALL ROLES CONSOLIDATED MATRIX ================= */}
      {(activeTab === 'ALL' || activeTab === 'TELLER') && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Landmark className="w-5 h-5 text-[#0d9488]" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Teller Workstation Daily Close
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              Counter Transactions: {dayTransactions.length}
            </span>
          </div>

          {/* Teller Till Summary Sub-cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Physical Cash Inflow</span>
              <span className="text-base font-black text-emerald-600">GHS {tellerDeposits.toFixed(2)}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Counter Cash Outflow</span>
              <span className="text-base font-black text-rose-600">GHS {tellerWithdrawals.toFixed(2)}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Till Cash Balance</span>
              <span className="text-base font-black text-[#0d9488]">GHS {(tellerDeposits - tellerWithdrawals).toFixed(2)}</span>
            </div>
          </div>

          {/* Table of Teller Transactions */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Receipt No</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                  <th className="py-2.5 px-3">Cashier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {dayTransactions.length > 0 ? (
                  dayTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-bold text-[#0d9488]">{tx.receiptNo || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                        {getCustomerNameForTx(tx)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === 'DEPOSIT' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-500">{tx.paymentMode || 'Physical Cash'}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                        GHS {tx.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 dark:text-slate-200">
                        {getOfficerNameForTx(tx)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                      No counter transactions recorded by tellers on {formattedSelectedDate}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= PANEL 2: FIELD OFFICERS SPLITTER CLOSE ================= */}
      {(activeTab === 'ALL' || activeTab === 'FIELD') && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Field Officer Collections & Mobile Splitter Close
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600">
              Total Field Pickups Today: GHS {fieldCollectionsTotal.toFixed(2)}
            </span>
          </div>

          {/* Table of Field Collections */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Receipt No</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Account No</th>
                  <th className="py-2.5 px-3">Cycle Day</th>
                  <th className="py-2.5 px-3">Package Rate</th>
                  <th className="py-2.5 px-3 text-right">Collected Amount (GHS)</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Collected / Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {dayFieldSplits.length > 0 ? (
                  dayFieldSplits.map((split, idx) => (
                    <tr key={`${split.receiptNo}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-bold text-[#0d9488]">{split.receiptNo}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">{split.customerName}</td>
                      <td className="py-2.5 px-3 text-slate-500">{split.accountNumber}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">Day {split.dayNumber}</div>
                        <div className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">Progress: Day {split.currentCycleDay} of 31</div>
                      </td>
                      <td className="py-2.5 px-3 text-[#0d9488]">GH₵ {split.savingsPackage}/Day</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                        GHS {split.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          split.isCompanyFee ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {split.isCompanyFee ? 'Day 31 Company Fee' : 'Client Daily Savings'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-600 dark:text-slate-300">
                        {split.recordedBy || 'Authorized Officer'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                      No field collections recorded on {formattedSelectedDate}.
                    </td>
                  </tr>
                )}
              </tbody>
              {dayFieldSplits.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-800 font-mono font-bold bg-slate-50/50 dark:bg-slate-950/50">
                    <td colSpan={5} className="py-2.5 px-3 text-slate-500 uppercase text-[10px]">
                      Total Collections Across {dayFieldSplits.length} Daily Contribution Day(s)
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-600 text-sm">
                      GHS {fieldCollectionsTotal.toFixed(2)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ================= PANEL 3: LOAN DESK DISBURSEMENTS & REPAYMENTS ================= */}
      {(activeTab === 'ALL' || activeTab === 'LOANS') && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Loan Desk Daily Activity & Credit Movements
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-blue-600">
              Loan Repayments Collected: GHS {loanRepaymentsTotal.toFixed(2)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">App No</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Principal (GHS)</th>
                  <th className="py-2.5 px-3 text-right">Total Repayable</th>
                  <th className="py-2.5 px-3 text-right">Outstanding Bal</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {dayLoans.length > 0 ? (
                  dayLoans.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-bold text-blue-600">{l.applicationNo}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                        {l.customer ? `${l.customer.firstName} ${l.customer.lastName}` : 'Client'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black">GHS {l.amountRequested.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold">GHS {l.totalRepayable.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600">GHS {l.outstandingBal.toFixed(2)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          l.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                      No loan applications or status changes created on {formattedSelectedDate}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= PANEL 4: SUPER ADMIN APPROVALS & SECURITY AUDIT ================= */}
      {(activeTab === 'ALL' || activeTab === 'APPROVALS' || activeTab === 'AUDIT') && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-[#0a3866]" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Super Admin Authorizations & Security Log
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              Clearances Reviewed: {dayApprovals.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Target Title</th>
                  <th className="py-2.5 px-3">Requester</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Super Admin Reviewer</th>
                  <th className="py-2.5 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {dayApprovals.length > 0 ? (
                  dayApprovals.map((appr) => (
                    <tr key={appr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">{appr.title}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300">
                        {appr.requestedByName} ({appr.requestedRole.replace(/_/g, ' ')})
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          appr.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : appr.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {appr.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">{appr.reviewedByName || 'Super Admin'}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-sans">{appr.reviewRemarks || 'Verified clearance.'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                      No clearance requests reviewed on {formattedSelectedDate}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= FORMAL END OF DAY CERTIFICATION SIGN-OFF ================= */}
      <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Official End of Day Institutional Sign-Off</span>
            </h4>
            <p className="text-xs text-slate-500">
              Certifies that all cash in vault, counter tills, field collections, and credit records are balanced and audited.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEodSignoffDone(true);
                alert(`✅ End of Day for ${formattedSelectedDate} has been officially signed off and locked into the immutable audit trail.`);
              }}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#0d9488] to-[#166534] hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-teal-900/10 cursor-pointer"
            >
              {eodSignoffDone ? '✓ Day Signed Off by Executive' : 'Sign-Off End of Day Close'}
            </button>
          </div>
        </div>
      </div>

      {/* ================= OFFICIAL PRINTABLE EOD STATEMENT MODAL ================= */}
      {isEodPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="max-w-4xl w-full max-h-[94vh] overflow-y-auto p-6 sm:p-8 rounded-3xl bg-white text-slate-900 shadow-2xl space-y-6 my-auto">
            
            {/* Letterhead Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
              <div className="flex items-center space-x-4">
                <img src={logoImg} alt="E-RIKON Logo" className="h-16 w-auto object-contain" />
                <div>
                  <h1 className="font-black text-xl text-slate-950 tracking-tight">E-RiKON Financial Company PLC</h1>
                  <p className="text-xs text-slate-600 font-semibold">Core Financial Management System (ECFMS)</p>
                  <p className="text-[11px] text-slate-500 font-medium">14 Independence Avenue, Ridge, Accra | +233 30 200 1122</p>
                </div>
              </div>

              <div className="text-left md:text-right font-mono text-xs space-y-0.5">
                <div className="font-black text-[#0d9488] text-sm uppercase">OFFICIAL END OF DAY RECONCILIATION</div>
                <div className="text-slate-800 font-bold">Operating Date: {formattedSelectedDate}</div>
                <div className="text-slate-500 text-[10px]">Printed: {new Date().toLocaleString('en-GB')}</div>
              </div>
            </div>

            {/* Reconciliation Cash Summary Box */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-100 text-xs font-mono border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Inflow</span>
                <span className="font-bold text-sm text-slate-900">GHS {totalDailyInflow.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Outflow</span>
                <span className="font-bold text-sm text-slate-900">GHS {totalDailyOutflow.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Net Day Variance</span>
                <span className="font-bold text-sm text-[#0d9488]">GHS {netDailyCashPosition.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Company Fee</span>
                <span className="font-bold text-sm text-amber-600">GHS {companyRetainedFeesToday.toFixed(2)}</span>
              </div>
            </div>

            {/* Institutional Breakdown */}
            <div className="space-y-2 text-xs">
              <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
                Multi-Workstation Daily Close Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">Teller Cash In:</span>
                  <span className="font-bold">GHS {tellerDeposits.toFixed(2)}</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">Field Collections:</span>
                  <span className="font-bold">GHS {fieldCollectionsTotal.toFixed(2)}</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">Loan Repayments:</span>
                  <span className="font-bold">GHS {loanRepaymentsTotal.toFixed(2)}</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">Withdrawals Paid:</span>
                  <span className="font-bold">GHS {tellerWithdrawals.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="border-b-2 border-slate-900 uppercase text-[9px] font-black">
                    <th className="py-2 px-2">Receipt No</th>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 px-2">Customer / Client</th>
                    <th className="py-2 px-2">Mode</th>
                    <th className="py-2 px-2 text-right">Amount (GHS)</th>
                    <th className="py-2 px-2">Officer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dayTransactions.length > 0 ? (
                    dayTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-1.5 px-2 font-bold text-[#0d9488]">{tx.receiptNo || '—'}</td>
                        <td className="py-1.5 px-2">{tx.type}</td>
                        <td className="py-1.5 px-2 font-sans font-bold">
                          {getCustomerNameForTx(tx)}
                        </td>
                        <td className="py-1.5 px-2 font-sans">{tx.paymentMode || 'Cash'}</td>
                        <td className="py-1.5 px-2 text-right font-black">GHS {tx.amount.toFixed(2)}</td>
                        <td className="py-1.5 px-2 font-sans">
                          {getOfficerNameForTx(tx)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400 font-sans">
                        No transactions recorded for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Signatures & Certification Footer */}
            <div className="pt-4 border-t-2 border-slate-900 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs font-mono">
              <div className="space-y-1">
                <div className="font-bold">Prepared By: {currentUser?.firstName} {currentUser?.lastName}</div>
                <div className="text-[10px] text-slate-500">Designation: {currentUser?.role.replace(/_/g, ' ')}</div>
              </div>

              <div className="space-y-1 text-right">
                <div className="font-bold border-b border-slate-400 pb-1 w-48 text-center">Super Admin Signature</div>
                <div className="text-[10px] text-slate-500 text-center">Certified Executive Approval</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Document</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEodPdfModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
