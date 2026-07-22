import React, { useState } from 'react';
import { MOCK_TRANSACTIONS, MOCK_LOANS } from '../services/api';
import { Transaction } from '../types';
import { ReceiptPrinterModal } from '../components/ui/ReceiptPrinterModal';
import { 
  FileSpreadsheet, 
  Download, 
  FileText, 
  Printer, 
  Calendar, 
  CheckCircle2,
  Table
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<Transaction | null>(null);

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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const data = MOCK_TRANSACTIONS.map((t) => ({
      ReceiptNo: t.receiptNo,
      RefNo: t.referenceNo,
      Customer: `${t.account?.customer?.firstName} ${t.account?.customer?.lastName}`,
      AccountNo: t.account?.accountNumber,
      GhanaCard: t.account?.customer?.ghanaCardNumber,
      Type: t.type,
      PaymentMode: t.paymentMode,
      Amount: t.amount,
      Date: t.createdAt,
    }));
    exportCsv('E-RIKON_Financial_Transactions_Report', data);
  };

  const handleExportLoans = () => {
    const data = MOCK_LOANS.map((l) => ({
      AppNo: l.applicationNo,
      Customer: `${l.customer?.firstName} ${l.customer?.lastName}`,
      GhanaCard: l.customer?.ghanaCardNumber,
      AmountRequested: l.amountRequested,
      InterestRatePercent: l.interestRate,
      TotalRepayable: l.totalRepayable,
      OutstandingBalance: l.outstandingBal,
      Status: l.status,
    }));
    exportCsv('E-RIKON_Loan_Portfolio_Report', data);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-amber-500" />
          Financial Reports & Export Center
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Generate Paperless PDF Receipts, Account Statements, and Export Excel / CSV Audit Files
        </p>
      </div>

      {/* Export Actions Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center space-x-3 text-amber-500">
            <FileSpreadsheet className="w-5 h-5" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Transactions Export</h3>
          </div>
          <p className="text-xs text-slate-500">
            Export physical deposits, withdrawals, and 31-day fee retentions into CSV / Excel.
          </p>
          <button
            onClick={handleExportTransactions}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-amber-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Export Transactions (CSV)</span>
          </button>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center space-x-3 text-emerald-500">
            <Table className="w-5 h-5" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Loan Arrears Report</h3>
          </div>
          <p className="text-xs text-slate-500">
            Download ER-Fast loan credit balances, interest schedules, and arrears analysis.
          </p>
          <button
            onClick={handleExportLoans}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Export Loan Arrears (CSV)</span>
          </button>
        </div>

      </div>

      {/* Transaction History & PDF Printable Receipts Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
          Completed Physical Financial Operations (Receipt Printer Ready)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Receipt No</th>
                <th className="py-2.5 px-3">Reference No</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Ghana Card</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {MOCK_TRANSACTIONS.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3 font-bold text-amber-500">{tx.receiptNo}</td>
                  <td className="py-3 px-3 text-slate-400">{tx.referenceNo}</td>
                  <td className="py-3 px-3 font-sans text-slate-800 dark:text-slate-200 font-medium">
                    {tx.account?.customer?.firstName} {tx.account?.customer?.lastName}
                  </td>
                  <td className="py-3 px-3 text-slate-400">{tx.account?.customer?.ghanaCardNumber}</td>
                  <td className="py-3 px-3 font-sans">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400">
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                    GHS {tx.amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => setSelectedTxForReceipt(tx)}
                      className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 font-bold border border-amber-500/30 text-[11px] font-sans flex items-center justify-center gap-1 mx-auto"
                    >
                      <Printer className="w-3.5 h-3.5" /> Printable Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      <ReceiptPrinterModal
        transaction={selectedTxForReceipt}
        onClose={() => setSelectedTxForReceipt(null)}
      />

    </div>
  );
};
