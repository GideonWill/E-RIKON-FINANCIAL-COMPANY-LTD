import React from 'react';
import { Transaction } from '../../types';
import logoImg from '../../assets/logo.jpeg';
import { Printer, CheckCircle2, X, ShieldCheck, Building2, Sparkles, Check } from 'lucide-react';

interface ReceiptPrinterModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onConfirmPaid?: (tx: Transaction) => void;
}

export const ReceiptPrinterModal: React.FC<ReceiptPrinterModalProps> = ({
  transaction,
  onClose,
  onConfirmPaid,
}) => {
  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleMarkPaid = () => {
    if (onConfirmPaid) {
      onConfirmPaid(transaction);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 relative my-auto max-h-[94vh] flex flex-col">
        
        {/* Modal Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Official Paperless Receipt
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Official Receipt Body Slip (Scrollable if screen is very small) */}
        <div 
          id="printable-receipt"
          className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-slate-900 dark:text-slate-100 font-mono relative overflow-y-auto max-h-[60vh] shrink"
        >
          {/* Watermark PAID Badge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-25deg] pointer-events-none opacity-15 border-4 border-emerald-500 text-emerald-500 font-black text-2xl px-6 py-2 rounded-xl tracking-widest select-none">
            PAID & STAMPED
          </div>

          {/* Receipt Header & Logo */}
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 dark:border-slate-800 pb-2.5">
            <div className="flex justify-center mb-1">
              <img 
                src={logoImg} 
                alt="E-RIKON Logo" 
                className="h-11 sm:h-12 w-auto object-contain rounded-lg"
              />
            </div>
            <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white font-sans tracking-tight">
              E-RIKON GROUP FINANCIAL COMPANY LTD
            </h4>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400">
              Accra Central Main Branch • Independence Avenue, Ridge
            </p>
            <div className="text-[10px] sm:text-[11px] font-bold text-amber-500 pt-0.5">
              OFFICIAL CASH RECEIPT • {transaction.receiptNo}
            </div>
          </div>

          {/* Customer & Transaction Info */}
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Date/Time:</span>
              <span className="font-medium">{new Date(transaction.createdAt).toLocaleString('en-GB')}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Reference No:</span>
              <span className="font-bold">{transaction.referenceNo}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Customer Name:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {transaction.account?.customer?.firstName} {transaction.account?.customer?.lastName}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Ghana Card:</span>
              <span>{transaction.account?.customer?.ghanaCardNumber || 'GHA-VERIFIED'}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Account No:</span>
              <span>{transaction.account?.accountNumber}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Transaction Type:</span>
              <span className="font-bold text-amber-500">{transaction.type.replace('_', ' ')}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Payment Mode:</span>
              <span>{transaction.paymentMode.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Amount Box */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">AMOUNT PAID:</span>
            <span className="text-lg font-black text-emerald-500">
              GHS {transaction.amount.toFixed(2)}
            </span>
          </div>

          {/* Balances */}
          <div className="space-y-1 text-[11px] pt-1 border-t border-dashed border-slate-300 dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Previous Balance:</span>
              <span>GHS {transaction.previousBal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-slate-400">New Balance:</span>
              <span className="text-emerald-500 dark:text-emerald-400">GHS {transaction.newBal.toFixed(2)}</span>
            </div>
          </div>

          {/* Recorded By Staff */}
          <div className="text-[9px] text-slate-500 dark:text-slate-400 text-center pt-1.5 border-t border-slate-200 dark:border-slate-800/60">
            Recorded By Staff: {transaction.recordedBy?.firstName || 'Teller'} {transaction.recordedBy?.lastName || 'Officer'}
          </div>

        </div>

        {/* Action Buttons (Always Pinned & Fully Visible) */}
        <div className="space-y-2 pt-1 shrink-0">
          <button
            type="button"
            onClick={handleMarkPaid}
            className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-500/25 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Mark Paid & Return to Screen</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Official Paper Copy</span>
          </button>
        </div>

      </div>
    </div>
  );
};
