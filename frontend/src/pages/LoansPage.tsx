import React, { useState } from 'react';
import { 
  getStoredLoans, 
  saveStoredLoans, 
  getStoredCustomers, 
  getStoredAccounts, 
  saveStoredAccounts,
  getStoredTransactions,
  saveStoredTransactions
} from '../services/api';
import { LoanApplication, LoanStatus, Transaction } from '../types';
import { LoanCalculatorWidget } from '../components/ui/LoanCalculatorWidget';
import { ReceiptPrinterModal } from '../components/ui/ReceiptPrinterModal';
import { 
  Calculator, 
  PlusCircle, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  UserCheck, 
  Sparkles,
  ArrowRight,
  DollarSign,
  Check,
  X
} from 'lucide-react';

export const LoansPage: React.FC = () => {
  const [loans, setLoans] = useState<LoanApplication[]>(getStoredLoans());
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication>(loans[0] || getStoredLoans()[0]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState<string>('1916.67');
  const [printedTx, setPrintedTx] = useState<Transaction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const customers = getStoredCustomers();
  const accounts = getStoredAccounts();

  const [selectedCustId, setSelectedCustId] = useState<string>(customers[0]?.id || '');
  const [amountReq, setAmountReq] = useState<number>(5000);
  const [tenorDays, setTenorDays] = useState<number>(90);
  const [purpose, setPurpose] = useState('Stock Inventory Purchase');

  // Rate Helper
  const getRate = (days: number) => {
    if (days <= 28) return { rate: 0.10, percent: 10, label: '1 Day – 4 Weeks' };
    if (days <= 90) return { rate: 0.15, percent: 15, label: '1 Month – 3 Months' };
    if (days <= 180) return { rate: 0.25, percent: 25, label: '3 Months – 6 Months' };
    return { rate: 0.30, percent: 30, label: '6 Months – 12 Months' };
  };

  const rateInfo = getRate(tenorDays);
  const totalInterest = amountReq * rateInfo.rate;
  const totalRepayable = amountReq + totalInterest;

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const applicantCust = customers.find((c) => c.id === selectedCustId) || customers[0];
    const applicantAcc = accounts.find((a) => a.customerId === applicantCust?.id) || accounts[0];

    const newLoan: LoanApplication = {
      id: `loan-${Date.now()}`,
      applicationNo: `LN-APP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: applicantCust?.id || 'cust-01',
      customer: applicantCust,
      accountId: applicantAcc?.id || 'acc-01',
      productId: 'lp-er-fast',
      amountRequested: amountReq,
      amountApproved: amountReq,
      tenorCategory: rateInfo.label,
      tenorValueDays: tenorDays,
      interestRate: rateInfo.percent,
      totalInterest,
      totalRepayable,
      outstandingBal: totalRepayable,
      purpose,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
      schedules: [
        {
          id: `sch-${Date.now()}-1`,
          installmentNo: 1,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          principalDue: Number((amountReq / 3).toFixed(2)),
          interestDue: Number((totalInterest / 3).toFixed(2)),
          totalDue: Number((totalRepayable / 3).toFixed(2)),
          principalPaid: 0,
          interestPaid: 0,
          isPaid: false,
        },
        {
          id: `sch-${Date.now()}-2`,
          installmentNo: 2,
          dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          principalDue: Number((amountReq / 3).toFixed(2)),
          interestDue: Number((totalInterest / 3).toFixed(2)),
          totalDue: Number((totalRepayable / 3).toFixed(2)),
          principalPaid: 0,
          interestPaid: 0,
          isPaid: false,
        },
        {
          id: `sch-${Date.now()}-3`,
          installmentNo: 3,
          dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          principalDue: Number((amountReq / 3).toFixed(2)),
          interestDue: Number((totalInterest / 3).toFixed(2)),
          totalDue: Number((totalRepayable / 3).toFixed(2)),
          principalPaid: 0,
          interestPaid: 0,
          isPaid: false,
        },
      ],
    };

    const updatedLoans = [newLoan, ...loans];
    setLoans(updatedLoans);
    setSelectedLoan(newLoan);
    saveStoredLoans(updatedLoans);
    setShowApplyModal(false);
  };

  const handleApprove = (loanId: string) => {
    const updatedLoans = loans.map((l) =>
      l.id === loanId ? { ...l, status: 'APPROVED' as LoanStatus } : l
    );
    setLoans(updatedLoans);
    saveStoredLoans(updatedLoans);
    if (selectedLoan?.id === loanId) {
      setSelectedLoan({ ...selectedLoan, status: 'APPROVED' });
    }
  };

  const handleDisburse = (loanId: string) => {
    const loanToDisburse = loans.find((l) => l.id === loanId);
    if (!loanToDisburse) return;

    const updatedLoans = loans.map((l) =>
      l.id === loanId ? { ...l, status: 'DISBURSED' as LoanStatus, disbursedAt: new Date().toISOString() } : l
    );
    setLoans(updatedLoans);
    saveStoredLoans(updatedLoans);

    if (selectedLoan?.id === loanId) {
      setSelectedLoan({ ...selectedLoan, status: 'DISBURSED' });
    }

    // Record Disbursement Transaction and update available balance
    const targetAcc = accounts.find((a) => a.id === loanToDisburse.accountId) || accounts[0];
    const previousBal = targetAcc.availableBalance;
    const newBal = previousBal + Number(loanToDisburse.amountRequested);

    const updatedAcc = { ...targetAcc, availableBalance: newBal, currentBalance: newBal };
    const updatedAccs = accounts.map((a) => (a.id === updatedAcc.id ? updatedAcc : a));
    saveStoredAccounts(updatedAccs);

    const newTx: Transaction = {
      id: `tx-disb-${Date.now()}`,
      referenceNo: `TX-DISB-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-DISB-${Date.now().toString().slice(-8)}`,
      accountId: targetAcc.id,
      account: updatedAcc,
      type: 'LOAN_DISBURSEMENT',
      paymentMode: 'PHYSICAL_CASH',
      amount: Number(loanToDisburse.amountRequested),
      previousBal,
      newBal,
      remarks: `Disbursement for ER-Fast Loan ${loanToDisburse.applicationNo}`,
      createdAt: new Date().toISOString(),
    };

    saveStoredTransactions([newTx, ...getStoredTransactions()]);
  };

  const handleRecordRepaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const paidAmt = Number(repayAmount);
    if (!paidAmt || paidAmt <= 0 || !selectedLoan) return;

    const curBal = Number(selectedLoan.outstandingBal);
    const newBal = Math.max(0, curBal - paidAmt);
    const isFullyPaid = newBal <= 0.01;

    // Deduct and update schedule items
    let remainingPaid = paidAmt;
    const updatedSchedules = selectedLoan.schedules?.map((sch) => {
      if (sch.isPaid || remainingPaid <= 0) return sch;
      if (remainingPaid >= sch.totalDue) {
        remainingPaid -= sch.totalDue;
        return { ...sch, isPaid: true, principalPaid: sch.principalDue, interestPaid: sch.interestDue };
      } else {
        const pPaid = Number(((sch.principalDue / sch.totalDue) * remainingPaid).toFixed(2));
        const iPaid = Number(((sch.interestDue / sch.totalDue) * remainingPaid).toFixed(2));
        remainingPaid = 0;
        return { 
          ...sch, 
          principalPaid: Math.min(sch.principalDue, sch.principalPaid + pPaid), 
          interestPaid: Math.min(sch.interestDue, sch.interestPaid + iPaid) 
        };
      }
    }) || [];

    const updatedLoanItem: LoanApplication = {
      ...selectedLoan,
      outstandingBal: newBal,
      status: isFullyPaid ? 'FULLY_PAID' : 'DISBURSED',
      schedules: updatedSchedules,
    };

    // Immediately update state and LocalStorage so remaining balance re-renders live
    const updatedLoansList = loans.map((l) => (l.id === selectedLoan.id ? updatedLoanItem : l));
    setLoans(updatedLoansList);
    setSelectedLoan(updatedLoanItem);
    saveStoredLoans(updatedLoansList);

    // Record Repayment Transaction
    const targetAcc = accounts.find((a) => a.id === selectedLoan.accountId) || accounts[0];
    const newTx: Transaction = {
      id: `tx-repay-${Date.now()}`,
      referenceNo: `TX-RPY-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-RPY-${Date.now().toString().slice(-8)}`,
      accountId: targetAcc.id,
      account: targetAcc,
      type: 'LOAN_REPAYMENT',
      paymentMode: 'PHYSICAL_CASH',
      amount: paidAmt,
      previousBal: curBal,
      newBal: newBal,
      recordedBy: {
        id: 'user-05',
        employeeId: 'EMP-012',
        firstName: 'Ama',
        lastName: 'Sarpong',
        email: 'loan.officer@erikon-group.com',
        phone: '+233 20 123 4567',
        role: 'LOAN_OFFICER',
        branchId: 'br-01',
      },
      remarks: `Repayment for Loan ${selectedLoan.applicationNo}. Updated Balance Left: GHS ${newBal.toFixed(2)}`,
      createdAt: new Date().toISOString(),
    };

    saveStoredTransactions([newTx, ...getStoredTransactions()]);
    setShowRepayModal(false);
    setPrintedTx(newTx);
  };

  const handleConfirmPaid = (tx: Transaction) => {
    setSuccessMessage(
      `✅ Loan Repayment GHS ${tx.amount.toFixed(2)} Recorded! Outstanding Balance Updated to: GHS ${tx.newBal.toFixed(2)}.`
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
            <Calculator className="w-6 h-6 text-amber-500" />
            ER-Fast Loans Desk
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Loan Origination, Tiered Tenor Rate Calculator, Approval Workflow & Repayment Ledger
          </p>
        </div>

        <button
          onClick={() => setShowApplyModal(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition-all text-xs cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Loan Application</span>
        </button>
      </div>

      {/* Success Notification Banner */}
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
        
        {/* Left Column: Loan Portfolio List */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Loan Applications</h3>
          {loans.map((loan) => {
            const isSelected = selectedLoan?.id === loan.id;
            return (
              <div
                key={loan.id}
                onClick={() => setSelectedLoan(loan)}
                className={`p-5 rounded-3xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-gradient-to-br from-slate-900 to-slate-950 text-white border-amber-500 shadow-xl ring-2 ring-amber-500/30'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-500">{loan.applicationNo}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    loan.status === 'FULLY_PAID'
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                      : loan.status === 'DISBURSED' || loan.status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : loan.status === 'APPROVED'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {loan.status.replace('_', ' ')}
                  </span>
                </div>

                <h4 className="font-extrabold text-sm mt-2">
                  {loan.customer?.firstName} {loan.customer?.lastName}
                </h4>

                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Outstanding Bal</span>
                    <span className={`font-extrabold ${loan.outstandingBal === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      GHS {loan.outstandingBal.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Tenor Rate</span>
                    <span className="font-bold text-amber-400">{loan.interestRate}% ({loan.tenorValueDays}d)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Loan Details & Repayment Schedule */}
        {selectedLoan && (
          <div className="lg:col-span-2 space-y-6">
            
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              
              {/* Selected Loan Banner & Actions */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-500">ER-FAST LOAN DOSSIER</span>
                  <h3 className="text-xl font-extrabold">{selectedLoan.applicationNo}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Client: {selectedLoan.customer?.firstName} {selectedLoan.customer?.lastName} ({selectedLoan.customer?.ghanaCardNumber})
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {selectedLoan.status === 'PENDING_REVIEW' && (
                    <button
                      onClick={() => handleApprove(selectedLoan.id)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
                    >
                      Approve Loan
                    </button>
                  )}
                  {selectedLoan.status === 'APPROVED' && (
                    <button
                      onClick={() => handleDisburse(selectedLoan.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
                    >
                      Disburse Cash
                    </button>
                  )}
                  {(selectedLoan.status === 'DISBURSED' || selectedLoan.status === 'ACTIVE') && (
                    <button
                      onClick={() => {
                        setRepayAmount((selectedLoan.outstandingBal / 2).toFixed(2));
                        setShowRepayModal(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Record Loan Repayment</span>
                    </button>
                  )}
                  {selectedLoan.status === 'FULLY_PAID' && (
                    <span className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1.5">
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>FULLY PAID & CLOSED</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Financial Terms Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Approved Principal</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">GHS {selectedLoan.amountApproved.toFixed(2)}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Tenor Interest Rate</span>
                  <span className="font-extrabold text-amber-500 text-sm">{selectedLoan.interestRate}%</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Repayable</span>
                  <span className="font-extrabold text-emerald-500 text-sm">GHS {selectedLoan.totalRepayable.toFixed(2)}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Actual Balance Left</span>
                  <span className={`font-extrabold text-sm ${selectedLoan.outstandingBal === 0 ? 'text-emerald-500 font-black' : 'text-rose-500'}`}>
                    GHS {selectedLoan.outstandingBal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Repayment Schedule Table */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Repayment Schedule Breakdown</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Inst #</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3 text-right">Principal</th>
                        <th className="py-2.5 px-3 text-right">Interest</th>
                        <th className="py-2.5 px-3 text-right">Total Due</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {selectedLoan.schedules?.map((sch) => (
                        <tr key={sch.id}>
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">#{sch.installmentNo}</td>
                          <td className="py-3 px-3 text-slate-400">{sch.dueDate}</td>
                          <td className="py-3 px-3 text-right">GHS {sch.principalDue.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right text-amber-500">GHS {sch.interestDue.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">GHS {sch.totalDue.toFixed(2)}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sch.isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}>
                              {sch.isPaid ? 'PAID' : 'PENDING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* Record Loan Repayment Modal */}
      {showRepayModal && selectedLoan && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowRepayModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" />
                Record Loan Repayment Cash
              </h3>
              <button onClick={() => setShowRepayModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordRepaymentSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Borrower Client</span>
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedLoan.customer?.firstName} {selectedLoan.customer?.lastName}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Current Outstanding: GHS {selectedLoan.outstandingBal.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Repayment Cash Amount (GHS) *</label>
                <div className="relative mt-1">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">GHS</span>
                  <input
                    required
                    type="number"
                    step="0.01"
                    max={selectedLoan.outstandingBal}
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-extrabold text-base focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex justify-between font-mono text-xs">
                <span className="text-slate-400">New Balance Left After Payment:</span>
                <span className="font-extrabold text-emerald-400">
                  GHS {Math.max(0, selectedLoan.outstandingBal - Number(repayAmount || 0)).toFixed(2)}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm flex items-center justify-center space-x-2 transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>Confirm Repayment & Update Ledger</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Loan Application Modal */}
      {showApplyModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowApplyModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-500" />
                Originate ER-Fast Loan Application
              </h3>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Target Applicant Customer *</label>
                <select
                  value={selectedCustId}
                  onChange={(e) => setSelectedCustId(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.ghanaCardNumber}) - {c.customerNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Requested Principal (GHS) *</label>
                  <input
                    required
                    type="number"
                    value={amountReq}
                    onChange={(e) => setAmountReq(Number(e.target.value))}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tenor Duration (Days) *</label>
                  <select
                    value={tenorDays}
                    onChange={(e) => setTenorDays(Number(e.target.value))}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-amber-500"
                  >
                    <option value={28}>28 Days (4 Wks) - 10% Rate</option>
                    <option value={90}>90 Days (3 Mos) - 15% Rate</option>
                    <option value={180}>180 Days (6 Mos) - 25% Rate</option>
                    <option value={365}>365 Days (12 Mos) - 30% Rate</option>
                  </select>
                </div>
              </div>

              {/* Tenor Rate Badge Notice */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">Calculated Tenor Rate</span>
                  <span className="font-bold text-amber-400">{rateInfo.label} ({rateInfo.percent}%)</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Total Repayable</span>
                  <span className="font-extrabold text-emerald-400">GHS {totalRepayable.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Loan Purpose</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Submit Application
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Repayment Receipt Modal */}
      <ReceiptPrinterModal
        transaction={printedTx}
        onClose={() => setPrintedTx(null)}
        onConfirmPaid={handleConfirmPaid}
      />

    </div>
  );
};
