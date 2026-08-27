import React, { useState, useEffect } from 'react';
import { 
  getStoredTransactions, 
  getStoredLoans, 
  getStoredAccounts, 
  getStoredCompanyInterest,
  clearAllFinancialReceipts,
  clearStoredTransactions
} from '../services/api';
import { pushLocalToCloud } from '../services/cloudSync';
import { useRealtimeSync } from '../services/realtimeSync';
import { Transaction, Account, DailySplitEntry, DailyCollectionCycle } from '../types';
import { ReceiptPrinterModal } from '../components/ui/ReceiptPrinterModal';
import logoImg from '../assets/logo.png';
import { 
  Building2, 
  Wallet, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  Send, 
  Mail, 
  Printer, 
  FileText, 
  X, 
  CheckCircle2, 
  Clock, 
  Smartphone, 
  Users, 
  Receipt,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Table,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(getStoredTransactions());
  const [loans, setLoans] = useState(getStoredLoans());
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<Transaction | null>(null);

  // Real-time synchronization
  useRealtimeSync(() => {
    setTransactions(getStoredTransactions());
    setAccounts(getStoredAccounts());
    setLoans(getStoredLoans());
  });

  // Statement Generator State
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [selectedCycleNumber, setSelectedCycleNumber] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [isStatementPdfModalOpen, setIsStatementPdfModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<string>('');
  const [isEmailCopied, setIsEmailCopied] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  // Sync selectedAccountId if accounts change
  useEffect(() => {
    if (accounts.length > 0 && (!selectedAccountId || !accounts.some((a) => a.id === selectedAccountId))) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount: Account | undefined = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  
  // Dynamically resolve client package rate and label based on the specific chosen client account
  const packageRate = selectedAccount?.savingsPackage || 0;
  const clientPackageLabel = selectedAccount 
    ? (selectedAccount.savingsPackage 
        ? `GH₵ ${selectedAccount.savingsPackage}.00 / Day`
        : selectedAccount.type 
        ? selectedAccount.type.replace(/_/g, ' ') 
        : 'Standard Account')
    : 'No Account Selected';

  // Retrieve all historical & active cycles for the chosen client account
  const availableCycles: DailyCollectionCycle[] = selectedAccount?.dailyCycles && selectedAccount.dailyCycles.length > 0
    ? selectedAccount.dailyCycles
    : [
        {
          id: 'cyc-1',
          cycleNumber: 1,
          currentDayCount: 0,
          dailyTargetAmount: packageRate,
          totalDeposited: 0,
          feeDeducted: false,
          companyFeeAmount: 0,
          isCompleted: false,
          startDate: '2026-08-01',
          dailySplits: [],
        },
      ];

  const activeCycle = availableCycles.find((c) => c.cycleNumber === selectedCycleNumber) || availableCycles[0];

  // 30-Day / 31-Day statement entries: ONLY actual recorded splits or clean unrecorded calendar days
  const dailySplits: DailySplitEntry[] = activeCycle?.dailySplits && activeCycle.dailySplits.length > 0
    ? activeCycle.dailySplits
    : Array.from({ length: 31 }, (_, idx) => {
        const dayNo = idx + 1;
        const currentCount = activeCycle?.currentDayCount || 0;
        const isPaid = dayNo <= currentCount && currentCount > 0;
        const accSuffix = selectedAccount?.accountNumber ? selectedAccount.accountNumber.slice(-4) : '0000';
        return {
          dayNumber: dayNo,
          date: `2026-08-${dayNo.toString().padStart(2, '0')}`,
          amount: isPaid ? packageRate : 0,
          receiptNo: isPaid ? `RCP-${accSuffix}-${dayNo.toString().padStart(3, '0')}` : '-',
          isCompanyFee: dayNo === 31,
        };
      });

  const totalPaidInCycle = dailySplits.reduce((sum, s) => sum + (s.amount || 0), 0);
  const companyFeeRetained = dailySplits.filter((s) => s.isCompanyFee && s.amount > 0).reduce((sum, s) => sum + s.amount, 0);
  const netClientSavings = Math.max(0, totalPaidInCycle - companyFeeRetained);

  const handleClearAllFinancialReceipts = () => {
    const confirmed = window.confirm(
      '⚠️ CLEAR ALL FINANCIAL RECEIPTS & STATEMENTS?\n\nThis will purge all transaction receipts, deposit splits, and interest histories from the system, and reset account balances to 0.00 GHS.\n\nClient profiles and chosen savings packages will be preserved.\n\nAre you sure you want to proceed?'
    );
    if (confirmed) {
      clearAllFinancialReceipts();
      setTransactions([]);
      setAccounts(getStoredAccounts());
      setDispatchStatus('✅ All financial statement receipts and transaction histories have been cleared successfully.');
    }
  };

  const exportCsv = (filename: string, rows: object[]) => {
    if (!rows.length) return;
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows
        .map((row) => {
          return keys
            .map((k) => {
              let cell = (row as any)[k] === null || (row as any)[k] === undefined ? '' : (row as any)[k];
              cell = cell instanceof Date ? cell.toLocaleString() : cell.toString().replace(/"/g, '""');
              if (cell.search(/("|,|\n)/g) >= 0) {
                cell = `"${cell}"`;
              }
              return cell;
            })
            .join(separator);
        })
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTransactions = () => {
    if (transactions.length === 0) {
      alert('No transactions recorded to export.');
      return;
    }
    const data = transactions.map((t) => ({
      ReceiptNo: t.receiptNo || '—',
      RefNo: t.referenceNo || '—',
      Customer: t.account?.customer ? `${t.account.customer.firstName} ${t.account.customer.lastName}` : 'Client',
      AccountNo: t.account?.accountNumber || '—',
      GhanaCard: t.account?.customer?.ghanaCardNumber || '—',
      Type: t.type,
      PaymentMode: t.paymentMode || 'Physical Cash',
      Amount: t.amount,
      Date: t.createdAt,
    }));
    exportCsv('E-RIKON_Financial_Transactions_Report', data);
  };

  const handleExportLoans = () => {
    if (loans.length === 0) {
      alert('No loan portfolio records to export.');
      return;
    }
    const data = loans.map((l) => ({
      AppNo: l.applicationNo,
      Customer: l.customer ? `${l.customer.firstName} ${l.customer.lastName}` : 'Client',
      GhanaCard: l.customer?.ghanaCardNumber || '—',
      AmountRequested: l.amountRequested,
      InterestRatePercent: l.interestRate,
      TotalRepayable: l.totalRepayable,
      OutstandingBalance: l.outstandingBal,
      Status: l.status,
    }));
    exportCsv('E-RIKON_Loan_Portfolio_Report', data);
  };

  // Month Options List (2026 Full Calendar)
  const MONTH_OPTIONS = [
    { value: '2026-08', label: 'August 2026' },
    { value: '2026-07', label: 'July 2026' },
    { value: '2026-06', label: 'June 2026' },
    { value: '2026-05', label: 'May 2026' },
    { value: '2026-04', label: 'April 2026' },
    { value: '2026-03', label: 'March 2026' },
    { value: '2026-02', label: 'February 2026' },
    { value: '2026-01', label: 'January 2026' },
    { value: '2026-09', label: 'September 2026' },
    { value: '2026-10', label: 'October 2026' },
    { value: '2026-11', label: 'November 2026' },
    { value: '2026-12', label: 'December 2026' },
  ];

  const getMonthTitle = (m: string) => {
    const found = MONTH_OPTIONS.find((opt) => opt.value === m);
    if (found) return found.label;
    const [y, mon] = m.split('-');
    return `${mon}/${y}`;
  };

  // Transactions belonging strictly to the selected client and selected month
  const monthlyClientTransactions: Transaction[] = transactions.filter((t) => {
    if (!selectedAccount) return false;
    const isClient = t.accountId === selectedAccount.id || t.account?.customerId === selectedAccount.customerId;
    const isMonth = t.createdAt ? t.createdAt.startsWith(selectedMonth) : false;
    return isClient && isMonth;
  });

  // Daily cycle splits for this client in the selected month
  const monthlyDailySplits: DailySplitEntry[] = (selectedAccount?.dailyCycles || []).flatMap((c) =>
    (c.dailySplits || []).filter((s) => s.date.startsWith(selectedMonth))
  );

  // Financial totals for the chosen month
  const monthDeposits = monthlyClientTransactions
    .filter((tx) => tx.type === 'DEPOSIT' || tx.type === 'LOAN_REPAYMENT')
    .reduce((sum, tx) => sum + tx.amount, 0) ||
    monthlyDailySplits.reduce((sum, s) => sum + (s.amount || 0), 0);

  const monthCompanyFee = monthlyClientTransactions
    .filter((tx) => tx.type === 'COMPANY_FEE_DEDUCTION')
    .reduce((sum, tx) => sum + tx.amount, 0) ||
    monthlyDailySplits.filter((s) => s.isCompanyFee && s.amount > 0).reduce((sum, s) => sum + s.amount, 0);

  const monthWithdrawals = monthlyClientTransactions
    .filter((tx) => tx.type === 'WITHDRAWAL')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthNetSavings = Math.max(0, monthDeposits - monthCompanyFee - monthWithdrawals);

  const handleExportCustomerStatement = () => {
    if (!selectedAccount) {
      alert('Please select a customer account first.');
      return;
    }
    const custName = selectedAccount.customer ? `${selectedAccount.customer.firstName} ${selectedAccount.customer.lastName}` : 'Client';
    const data = monthlyClientTransactions.length > 0
      ? monthlyClientTransactions.map((tx, idx) => ({
          Index: idx + 1,
          DateTime: tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-GB') : '—',
          ReceiptNo: tx.receiptNo || '—',
          ReferenceNo: tx.referenceNo || '—',
          Description: tx.type ? tx.type.replace('_', ' ') : 'Transaction',
          PaymentMode: tx.paymentMode ? tx.paymentMode.replace('_', ' ') : 'Cash',
          Amount: tx.amount,
          PreviousBalance: tx.previousBal || 0,
          NewBalance: tx.newBal || 0,
          Customer: custName,
          AccountNo: selectedAccount.accountNumber || '—',
          GhanaCard: selectedAccount.customer?.ghanaCardNumber || '—',
        }))
      : monthlyDailySplits.map((s, idx) => ({
          Index: idx + 1,
          DateTime: `${s.date} 09:00:00`,
          ReceiptNo: s.receiptNo || '—',
          ReferenceNo: `CYC-SPLIT-${s.dayNumber}`,
          Description: s.isCompanyFee ? 'Company 31-Day Management Fee' : 'Daily Collection Deposit',
          PaymentMode: 'Physical Cash',
          Amount: s.amount,
          PreviousBalance: Math.max(0, (s.amount * s.dayNumber) - s.amount),
          NewBalance: s.amount * s.dayNumber,
          Customer: custName,
          AccountNo: selectedAccount.accountNumber || '—',
          GhanaCard: selectedAccount.customer?.ghanaCardNumber || '—',
        }));

    exportCsv(`E-RIKON_Statement_${selectedAccount.customer?.firstName || 'Client'}_${selectedMonth}`, data);
  };

  const handleSendWhatsApp = () => {
    if (!selectedAccount || !selectedAccount.customer?.phone) {
      alert('Selected customer has no registered phone number.');
      return;
    }
    const phoneDigits = selectedAccount.customer.phone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
      `📊 *E-RiKON Financial Company PLC*\n` +
      `*Monthly Statement - ${getMonthTitle(selectedMonth)}*\n\n` +
      `👤 *Client:* ${selectedAccount.customer?.firstName || ''} ${selectedAccount.customer?.lastName || ''}\n` +
      `🔢 *Account No:* ${selectedAccount.accountNumber || '—'}\n` +
      `📦 *Savings Package:* ${clientPackageLabel}\n` +
      `📅 *Billing Month:* ${getMonthTitle(selectedMonth)}\n` +
      `💰 *Total Deposited in ${getMonthTitle(selectedMonth)}:* GHS ${monthDeposits.toFixed(2)}\n` +
      `🌟 *Company Fee (31 Days):* GHS ${monthCompanyFee.toFixed(2)}\n` +
      `💵 *Net Available Savings:* GHS ${monthNetSavings.toFixed(2)}\n\n` +
      `Thank you for saving with E-RiKON. Verified core banking operations.`
    );
    window.open(`https://wa.me/${phoneDigits}?text=${message}`, '_blank');
    setDispatchStatus(`Statement for ${getMonthTitle(selectedMonth)} dispatched to ${selectedAccount.customer?.firstName}'s WhatsApp (+${phoneDigits})!`);
    setTimeout(() => setDispatchStatus(null), 5000);
  };

  const generateEmailBodyText = () => {
    const cust = selectedAccount?.customer;
    const monthTitle = getMonthTitle(selectedMonth);

    let rowsText = '';
    if (monthlyClientTransactions.length > 0) {
      rowsText = monthlyClientTransactions
        .map((tx, idx) => {
          const dt = tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-GB') : '—';
          const desc = tx.type === 'COMPANY_FEE_DEDUCTION' ? 'Day 31 Company Fee Retained' : tx.type?.replace('_', ' ') || 'Transaction';
          return `${idx + 1}. [${dt}] ${tx.receiptNo || '—'} | ${desc} | GHS ${tx.amount.toFixed(2)} | Bal: GHS ${(tx.newBal || 0).toFixed(2)}`;
        })
        .join('\n');
    } else if (monthlyDailySplits.length > 0) {
      rowsText = monthlyDailySplits
        .map((s, idx) => {
          const desc = s.isCompanyFee ? 'Day 31 Company Fee Retained' : 'Daily Collection Deposit';
          return `${idx + 1}. [${s.date} 09:00:00] ${s.receiptNo || '—'} | ${desc} | GHS ${s.amount.toFixed(2)} | Bal: GHS ${(s.amount * s.dayNumber).toFixed(2)}`;
        })
        .join('\n');
    } else {
      rowsText = 'No transactions recorded for this billing month.';
    }

    return (
      `=====================================================\n` +
      `E-RiKON Financial Company PLC\n` +
      `OFFICIAL STATEMENT • ${monthTitle.toUpperCase()}\n` +
      `=====================================================\n\n` +
      `Dear ${cust?.firstName || 'Valued Client'} ${cust?.lastName || ''},\n\n` +
      `Please find below your verified monthly account statement summary for ${monthTitle}.\n\n` +
      `ACCOUNT DETAILS:\n` +
      `-----------------------------------------------------\n` +
      `• Client Name: ${cust?.firstName || ''} ${cust?.lastName || ''}\n` +
      `• Account Number: ${selectedAccount?.accountNumber || '—'}\n` +
      `• Ghana Card PIN: ${cust?.ghanaCardNumber || '—'}\n` +
      `• Savings Package: ${clientPackageLabel}\n` +
      `• Statement Period: ${monthTitle}\n\n` +
      `FINANCIAL SUMMARY:\n` +
      `-----------------------------------------------------\n` +
      `• Total Deposits in ${monthTitle}: GHS ${monthDeposits.toFixed(2)}\n` +
      `• Company 31-Day Management Fee: GHS ${monthCompanyFee.toFixed(2)}\n` +
      `• Net Available Savings: GHS ${monthNetSavings.toFixed(2)}\n\n` +
      `ITEMIZED STATEMENT OF TRANSACTIONS:\n` +
      `-----------------------------------------------------\n` +
      `${rowsText}\n\n` +
      `-----------------------------------------------------\n` +
      `Certified Official Record by ECFMS Core Banking System.\n` +
      `E-RiKON Financial Company PLC\n` +
      `📍 14 Independence Avenue, Ridge, Accra | 📞 +233 30 200 1122\n` +
      `🌐 www.e-rikonfinancial.com\n` +
      `=====================================================`
    );
  };

  const handleOpenEmailModal = () => {
    setEmailRecipient(selectedAccount?.customer?.email || '');
    setIsEmailModalOpen(true);
  };

  const handleLaunchMailto = () => {
    const subject = `Official Monthly Financial Statement - ${getMonthTitle(selectedMonth)} | E-RiKON Financial Company PLC`;
    const body = generateEmailBodyText();
    const targetEmail = emailRecipient.trim();
    window.open(`mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    setDispatchStatus(`Email client opened for ${targetEmail || selectedAccount?.customer?.firstName || 'client'}!`);
    setTimeout(() => setDispatchStatus(null), 5000);
  };

  const handleLaunchGmailWeb = () => {
    const subject = `Official Monthly Financial Statement - ${getMonthTitle(selectedMonth)} | E-RiKON Financial Company PLC`;
    const body = generateEmailBodyText();
    const targetEmail = emailRecipient.trim();
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
    setDispatchStatus(`Opening Gmail composer for ${targetEmail || selectedAccount?.customer?.firstName || 'client'}!`);
    setTimeout(() => setDispatchStatus(null), 5000);
  };

  const handleCopyEmailStatement = () => {
    const body = generateEmailBodyText();
    navigator.clipboard.writeText(body);
    setIsEmailCopied(true);
    setTimeout(() => setIsEmailCopied(false), 3000);
    setDispatchStatus('✅ Statement text copied to clipboard!');
    setTimeout(() => setDispatchStatus(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#0d9488]" />
            Financial Statements, Reports & Client Dispatch
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generate Official PDF Statements (GH₵ 5 - 200 Packages), Export Excel/CSV Files & Dispatch to Clients via WhatsApp / SMS / Email
          </p>
        </div>

        <button
          type="button"
          onClick={handleClearAllFinancialReceipts}
          className="px-4 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer w-fit"
          title="Clear all transactions, receipts, and splits from system"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear All Financial Receipts</span>
        </button>
      </div>

      {/* Dispatch Alert */}
      {dispatchStatus && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{dispatchStatus}</span>
          </div>
          <button onClick={() => setDispatchStatus(null)} className="text-white font-mono cursor-pointer">✕</button>
        </div>
      )}

      {/* Export Actions Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center space-x-3 text-[#0d9488]">
            <FileSpreadsheet className="w-5 h-5" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Transactions Ledger</h3>
          </div>
          <p className="text-xs text-slate-500">
            Export physical deposits, withdrawals, and 31-day fee retentions into CSV / Excel.
          </p>
          <button
            onClick={handleExportTransactions}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0d9488] to-[#166534] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-teal-900/10 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Transactions (CSV)</span>
          </button>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center space-x-3 text-emerald-600">
            <Table className="w-5 h-5" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Loan Portfolio Report</h3>
          </div>
          <p className="text-xs text-slate-500">
            Download ER-Fast loan credit balances, interest schedules, and arrears analysis.
          </p>
          <button
            onClick={handleExportLoans}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Loans (CSV)</span>
          </button>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center space-x-3 text-blue-600">
            <FileText className="w-5 h-5" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Month-to-Month Statement</h3>
          </div>
          <p className="text-xs text-slate-500">
            Official E-RIKON printable letterhead PDF with 30-day savings breakdown.
          </p>
          <button
            onClick={() => setIsStatementPdfModalOpen(true)}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Open PDF Statement View</span>
          </button>
        </div>

      </div>

      {/* Monthly Customer Statement Hub */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#0d9488]" />
              Month-to-Month Customer Statement & Dispatch Center
            </h3>
            <p className="text-xs text-slate-500">
              Select client and monthly period to inspect transaction records with timestamps and generate PDF statements.
            </p>
          </div>

          {/* Selectors & Dispatch Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {accounts.length > 0 ? (
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setSelectedCycleNumber(1);
                }}
                className="py-2 px-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-bold text-slate-950 dark:text-white shadow-xs cursor-pointer"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="text-slate-950 dark:text-white bg-white dark:bg-slate-900">
                    {acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : 'Client'} ({acc.accountNumber})
                  </option>
                ))}
              </select>
            ) : (
              <span className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-500">
                No accounts registered yet
              </span>
            )}

            {/* Month Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="py-2 px-3.5 rounded-xl bg-white dark:bg-slate-950 border border-teal-500/60 text-xs font-black text-teal-800 dark:text-teal-400 font-mono shadow-xs cursor-pointer"
              title="Select specific month to filter records"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value} className="text-slate-950 dark:text-white bg-white dark:bg-slate-900 font-sans">
                  {m.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsStatementPdfModalOpen(true)}
              className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
              title="Download/Print PDF statement for this selected month"
            >
              <Printer className="w-4 h-4" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={handleSendWhatsApp}
              className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>WhatsApp Client</span>
            </button>

            <button
              type="button"
              onClick={handleOpenEmailModal}
              className="py-2 px-3.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Open email composer to send verified statement to client"
            >
              <Mail className="w-4 h-4 text-blue-500" />
              <span>Email Statement</span>
            </button>

            <button
              onClick={handleExportCustomerStatement}
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Client & Month Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Client Package</span>
            <span className="text-base font-black text-[#0d9488] font-mono">
              {clientPackageLabel}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Month Deposits</span>
            <span className="text-base font-black text-slate-900 dark:text-white font-mono">GHS {monthDeposits.toFixed(2)}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Company 31-Day Fee</span>
            <span className="text-base font-black text-emerald-600 font-mono">GHS {monthCompanyFee.toFixed(2)}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Month Savings</span>
            <span className="text-base font-black text-blue-600 font-mono">GHS {monthNetSavings.toFixed(2)}</span>
          </div>
        </div>

        {/* Month Financial Statement Table with Date & Exact Time */}
        <div className="overflow-x-auto">
          <div className="flex items-center justify-between pb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#0d9488]" />
              <span>Records for: <b className="text-[#0d9488] font-mono">{getMonthTitle(selectedMonth)}</b></span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {monthlyClientTransactions.length > 0 
                ? `${monthlyClientTransactions.length} transaction(s) found`
                : monthlyDailySplits.length > 0
                ? `${monthlyDailySplits.length} daily contribution(s) found`
                : '0 records in this month'}
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Date & Exact Time</th>
                <th className="py-2.5 px-3">Receipt No</th>
                <th className="py-2.5 px-3">Reference No</th>
                <th className="py-2.5 px-3">Classification</th>
                <th className="py-2.5 px-3">Payment Channel</th>
                <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                <th className="py-2.5 px-3 text-right">Running Balance</th>
                <th className="py-2.5 px-3 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {monthlyClientTransactions.length > 0 ? (
                monthlyClientTransactions.map((tx, idx) => {
                  const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date();
                  const formattedDateTime = txDate.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{idx + 1}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
                        <span>{formattedDateTime}</span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#0d9488]">{tx.receiptNo || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500">{tx.referenceNo || '—'}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {tx.type === 'COMPANY_FEE_DEDUCTION' ? 'Day 31 Company Fee Retained' : tx.type?.replace('_', ' ') || 'Transaction'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-500">
                        {tx.paymentMode ? tx.paymentMode.replace('_', ' ') : 'Cash'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                        GHS {tx.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                        GHS {(tx.newBal || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedTxForReceipt(tx)}
                          className="px-2 py-0.5 rounded bg-teal-50 hover:bg-[#0d9488] text-[#0d9488] hover:text-white font-bold text-[11px] transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : monthlyDailySplits.length > 0 ? (
                monthlyDailySplits.map((split) => (
                  <tr key={split.dayNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">Day {split.dayNumber}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
                      <span>{split.date} 09:00:00</span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#0d9488]">{split.receiptNo}</td>
                    <td className="py-2.5 px-3 text-slate-500">CYC-SPLIT-{split.dayNumber}</td>
                    <td className="py-2.5 px-3 font-sans">
                      {split.isCompanyFee ? 'Day 31 Company Fee Retained' : 'Daily Collection Deposit'}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-500">Physical Cash</td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                      GHS {split.amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      GHS {(split.amount * split.dayNumber).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] text-slate-400 font-sans">Ticked</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {selectedAccount 
                          ? `No financial transaction records recorded in ${getMonthTitle(selectedMonth)} for ${selectedAccount.customer?.firstName || 'client'}.`
                          : 'No customer accounts available. Register a customer and open a savings package to view records.'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {selectedAccount ? 'Select another month from the dropdown above to view records.' : 'Visit Customer 360 to register new clients.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Completed Physical Operations Receipts Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            Completed Financial Operations (Receipts Archive)
          </h3>
          {transactions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear all recorded receipts and transaction histories from the archive?')) {
                  clearStoredTransactions();
                  setTransactions([]);
                  pushLocalToCloud().catch(() => {});
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Receipts Archive</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Receipt No</th>
                <th className="py-2.5 px-3">Reference No</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {transactions.length > 0 ? (
                transactions.slice(0, 10).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#0d9488]">{tx.receiptNo || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-500">{tx.referenceNo || '—'}</td>
                    <td className="py-2.5 px-3 font-bold font-sans text-slate-900 dark:text-white">
                      {tx.account?.customer ? `${tx.account.customer.firstName} ${tx.account.customer.lastName}` : 'Client'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                      GHS {tx.amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-GB') : '—'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setSelectedTxForReceipt(tx)}
                        className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-[#0d9488] text-[#0d9488] hover:text-white font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                    No transactions recorded yet in the ledger.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official PDF Statement Modal */}
      {isStatementPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-4xl w-full max-h-[94vh] overflow-y-auto p-5 sm:p-8 rounded-3xl bg-white text-slate-900 shadow-2xl space-y-5 my-auto" id="official-statement-printable">
            
            {/* Letterhead Header - Fully Responsive on Mobile & Desktop */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
              <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
                <img src={logoImg} alt="E-RIKON Logo" className="h-14 sm:h-16 w-auto object-contain shrink-0 mt-0.5 sm:mt-0" />
                <div className="space-y-0.5">
                  <h1 className="font-black text-lg sm:text-xl text-slate-950 tracking-tight leading-snug">
                    E-RiKON Financial Company PLC
                  </h1>
                  <p className="text-xs text-slate-600 font-semibold">Core Financial Management System (ECFMS)</p>
                  <p className="text-[11px] text-slate-500 font-medium">14 Independence Avenue, Ridge, Accra | +233 30 200 1122</p>
                </div>
              </div>

              <div className="text-left md:text-right font-mono text-xs p-3 md:p-0 rounded-2xl md:rounded-none bg-teal-50 md:bg-transparent border border-teal-200 md:border-none shrink-0 space-y-0.5">
                <div className="font-black text-[#0d9488] text-xs sm:text-sm uppercase tracking-wide">
                  OFFICIAL STATEMENT • {getMonthTitle(selectedMonth).toUpperCase()}
                </div>
                <div className="text-slate-800 font-bold">Billing Period: {getMonthTitle(selectedMonth)}</div>
                <div className="text-slate-500 text-[10px]">Issued: {new Date().toLocaleString('en-GB')}</div>
              </div>
            </div>

            {/* Client Summary Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-100 text-xs font-mono border border-slate-200">
              <div className="p-1">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Client Name</span>
                <span className="font-bold font-sans text-sm text-slate-900">
                  {selectedAccount?.customer ? `${selectedAccount.customer.firstName} ${selectedAccount.customer.lastName}` : 'Unregistered Client'}
                </span>
              </div>
              <div className="p-1">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Account No</span>
                <span className="font-bold text-slate-900">{selectedAccount?.accountNumber || '—'}</span>
              </div>
              <div className="p-1">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Ghana Card PIN</span>
                <span className="font-bold text-slate-900">{selectedAccount?.customer?.ghanaCardNumber || '—'}</span>
              </div>
              <div className="p-1">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Savings Package</span>
                <span className="font-bold text-[#0d9488]">{clientPackageLabel}</span>
              </div>
            </div>

            {/* Statement Summary Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center p-4 rounded-2xl bg-slate-900 text-white font-mono text-xs">
              <div className="p-1">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total {getMonthTitle(selectedMonth)} Deposits</span>
                <span className="text-base sm:text-lg font-black">GHS {monthDeposits.toFixed(2)}</span>
              </div>
              <div className="p-1">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Company 31-Day Management Fee</span>
                <span className="text-base sm:text-lg font-black text-amber-400">GHS {monthCompanyFee.toFixed(2)}</span>
              </div>
              <div className="p-1">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Net Month Savings</span>
                <span className="text-base sm:text-lg font-black text-emerald-400">GHS {monthNetSavings.toFixed(2)}</span>
              </div>
            </div>

            {/* Monthly Itemized Table with Date and Exact Time */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-slate-900 uppercase text-[9px] font-black">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Date & Exact Time</th>
                    <th className="py-2 px-2">Receipt No</th>
                    <th className="py-2 px-2">Reference No</th>
                    <th className="py-2 px-2">Description</th>
                    <th className="py-2 px-2">Mode</th>
                    <th className="py-2 px-2 text-right">Amount (GHS)</th>
                    <th className="py-2 px-2 text-right">Balance (GHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {monthlyClientTransactions.length > 0 ? (
                    monthlyClientTransactions.map((tx, idx) => {
                      const dt = tx.createdAt ? new Date(tx.createdAt) : new Date();
                      const formattedDt = dt.toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 font-bold">{idx + 1}</td>
                          <td className="py-1.5 px-2 font-bold text-slate-800">{formattedDt}</td>
                          <td className="py-1.5 px-2 text-[#0d9488] font-bold">{tx.receiptNo || '—'}</td>
                          <td className="py-1.5 px-2 text-slate-600">{tx.referenceNo || '—'}</td>
                          <td className="py-1.5 px-2 font-sans font-medium">
                            {tx.type === 'COMPANY_FEE_DEDUCTION' ? 'Day 31 Company Fee Retained' : tx.type?.replace('_', ' ') || 'Transaction'}
                          </td>
                          <td className="py-1.5 px-2 text-slate-600 font-sans">{tx.paymentMode ? tx.paymentMode.replace('_', ' ') : 'Cash'}</td>
                          <td className="py-1.5 px-2 text-right font-black">GHS {tx.amount.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right font-bold text-emerald-600">GHS {(tx.newBal || 0).toFixed(2)}</td>
                        </tr>
                      );
                    })
                  ) : monthlyDailySplits.length > 0 ? (
                    monthlyDailySplits.map((s, idx) => (
                      <tr key={s.dayNumber} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2 font-bold">{idx + 1}</td>
                        <td className="py-1.5 px-2 font-bold text-slate-800">{s.date} 09:00:00</td>
                        <td className="py-1.5 px-2 text-[#0d9488] font-bold">{s.receiptNo}</td>
                        <td className="py-1.5 px-2 text-slate-600">CYC-SPLIT-{s.dayNumber}</td>
                        <td className="py-1.5 px-2 font-sans">
                          {s.isCompanyFee ? 'Company 31-Day Management Fee' : 'Daily Collection Deposit'}
                        </td>
                        <td className="py-1.5 px-2 font-sans text-slate-600">Physical Cash</td>
                        <td className="py-1.5 px-2 text-right font-black">GHS {s.amount.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-emerald-600">GHS {(s.amount * s.dayNumber).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500 font-sans">
                        No financial transactions or savings records recorded in {getMonthTitle(selectedMonth)} for this client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Official Stamp & Verification Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t-2 border-slate-900 text-xs">
              <div className="space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>E-RiKON OFFICIAL STATEMENT RECORD</span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  Certified by Super Admin & Head of Audit • E-RiKON Financial Company PLC
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Download / Print Official PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStatementPdfModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Dispatch Statement by Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-2xl w-full max-h-[94vh] overflow-y-auto p-5 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 my-auto text-slate-900 dark:text-white">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 shadow-sm">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Dispatch Statement by Email
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Send verified financial statement for <b>{getMonthTitle(selectedMonth)}</b> to client
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Client Email Address:</span>
                {!selectedAccount?.customer?.email && (
                  <span className="text-[10px] text-amber-500 font-normal">No email on file - please type recipient email</span>
                )}
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="e.g. client.name@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500/30 outline-none"
              />
            </div>

            {/* Subject Line Display */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Subject Line:
              </label>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300 select-all">
                Official Monthly Financial Statement - {getMonthTitle(selectedMonth)} | E-RiKON Financial Company PLC
              </div>
            </div>

            {/* Statement Text Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Statement Body Preview:
                </label>
                <button
                  type="button"
                  onClick={handleCopyEmailStatement}
                  className="text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {isEmailCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isEmailCopied ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>
              <textarea
                readOnly
                value={generateEmailBodyText()}
                rows={8}
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 resize-none outline-none leading-relaxed"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleLaunchMailto}
                className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
              >
                <Mail className="w-4 h-4" />
                <span>Open Mail App</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchGmailWeb}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-rose-500/20 cursor-pointer transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Gmail</span>
              </button>

              <button
                type="button"
                onClick={handleCopyEmailStatement}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {isEmailCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{isEmailCopied ? 'Copied' : 'Copy Statement'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptPrinterModal
        transaction={selectedTxForReceipt}
        onClose={() => setSelectedTxForReceipt(null)}
      />

    </div>
  );
};
