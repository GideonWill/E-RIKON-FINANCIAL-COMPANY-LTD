import React, { useState } from 'react';
import { 
  getStoredCompanyInterest, 
  getStoredCompanyWithdrawals, 
  requestCompanyInterestWithdrawal, 
  getStoredAccounts,
  emptyVaultBalance
} from '../services/api';
import { useRealtimeSync, broadcastRealtimeEvent } from '../services/realtimeSync';
import { pushLocalToCloud } from '../services/cloudSync';
import { CompanyInterestRecord, CompanyInterestWithdrawal } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  PiggyBank, 
  ArrowUpRight, 
  Building2, 
  Smartphone, 
  Vault, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Coins, 
  ShieldCheck, 
  Search, 
  Filter,
  Download,
  Calendar,
  Layers,
  Sparkles,
  ArrowDownRight,
  Trash2,
  X,
  ChevronDown,
  Check
} from 'lucide-react';

export const CompanyInterestPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [interestRecords, setInterestRecords] = useState<CompanyInterestRecord[]>(getStoredCompanyInterest());
  const [withdrawals, setWithdrawals] = useState<CompanyInterestWithdrawal[]>(getStoredCompanyWithdrawals());
  const [accounts, setAccounts] = useState(getStoredAccounts());
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time multi-device subscription
  useRealtimeSync(() => {
    setInterestRecords(getStoredCompanyInterest());
    setWithdrawals(getStoredCompanyWithdrawals());
    setAccounts(getStoredAccounts());
  });
  
  // Modal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState(false);
  const [isDestinationDropdownOpen, setIsDestinationDropdownOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [destinationType, setDestinationType] = useState<'COMPANY_BANK_ACCOUNT' | 'MTN_MOMO_MERCHANT' | 'VAULT_CASH'>('COMPANY_BANK_ACCOUNT');
  const [destinationDetails, setDestinationDetails] = useState('GCB Bank Corporate Account #10129384910');
  const [withdrawRemarks, setWithdrawRemarks] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const DESTINATION_OPTIONS = [
    {
      type: 'COMPANY_BANK_ACCOUNT' as const,
      label: 'Company Bank Account',
      desc: 'GCB Bank Corporate Wire Account',
      icon: Building2,
      defaultDetails: 'GCB Bank Corporate Account #10129384910'
    },
    {
      type: 'MTN_MOMO_MERCHANT' as const,
      label: 'MTN Mobile Money Merchant',
      desc: 'Corporate Merchant SIM Settlement',
      icon: Smartphone,
      defaultDetails: 'MTN Mobile Money Merchant: 0244112233'
    },
    {
      type: 'VAULT_CASH' as const,
      label: 'Branch Vault Cash',
      desc: 'Physical Cash Allocation at Head Office',
      icon: Vault,
      defaultDetails: 'Accra Central Vault Physical Cash Allocation'
    }
  ];

  // Financial Calculations
  const totalPiledUp = interestRecords.reduce((sum, r) => sum + r.accumulatedAmount, 0);
  const totalApprovedWithdrawn = withdrawals
    .filter((w) => w.status === 'APPROVED')
    .reduce((sum, w) => sum + w.amount, 0);
  const availableVaultBalance = Math.max(0, totalPiledUp - totalApprovedWithdrawn);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  const handleEmptyVault = () => {
    emptyVaultBalance();
    setInterestRecords([]);
    setWithdrawals([]);
    setIsConfirmEmptyOpen(false);
    broadcastRealtimeEvent('VAULT_CLEARED', {});
    pushLocalToCloud().catch(() => {});
    setSuccessMsg('🎉 Company Interest Vault balance has been successfully emptied to GHS 0.00.');
    setTimeout(() => {
      setSuccessMsg(null);
    }, 5000);
  };

  const handleWithdrawalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(withdrawAmount);
    if (!numAmount || numAmount <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }

    if (numAmount > availableVaultBalance) {
      alert(`Withdrawal amount (GHS ${numAmount.toFixed(2)}) exceeds available interest vault balance (GHS ${availableVaultBalance.toFixed(2)}).`);
      return;
    }

    if (!currentUser) return;

    const newWd = requestCompanyInterestWithdrawal(
      numAmount,
      destinationType,
      destinationDetails,
      currentUser,
      withdrawRemarks
    );

    setWithdrawals(getStoredCompanyWithdrawals());
    broadcastRealtimeEvent('INTEREST_WITHDRAWAL_REQUESTED', newWd);
    pushLocalToCloud().catch(() => {});
    setIsWithdrawModalOpen(false);
    setWithdrawAmount('');
    setWithdrawRemarks('');

    setSuccessMsg(
      `🎉 Withdrawal Request for GHS ${numAmount.toFixed(2)} submitted! Reference #${newWd.referenceNo} was sent to Super Admin for clearance approval.`
    );

    setTimeout(() => {
      setSuccessMsg(null);
    }, 5000);
  };

  const filteredRecords = interestRecords.filter((r) => {
    const rawSearch = searchQuery.trim().toLowerCase();
    if (!rawSearch) return true;

    const custName = (r.customerName || '').toLowerCase();
    const accNo = (r.accountNumber || '').toLowerCase();
    const period = (r.period || '').toLowerCase();
    const cleanSearch = rawSearch.replace(/\s+/g, ' ');

    const directMatch =
      custName.includes(cleanSearch) ||
      accNo.includes(cleanSearch) ||
      period.includes(cleanSearch);

    const searchTokens = cleanSearch.split(' ').filter(Boolean);
    const tokensMatch = searchTokens.every(
      (tok) => custName.includes(tok) || accNo.includes(tok) || period.includes(tok)
    );

    return directMatch || tokensMatch;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-amber-500" />
            Company Interest Vault & 30-Day Accumulation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitors 30-Day Member Interest Piled Up for E-RIKON & On-Demand Corporate Withdrawals
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setIsConfirmEmptyOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-500/10 text-slate-700 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-rose-500/20 hover:text-rose-500 dark:hover:text-rose-400 font-bold text-xs flex items-center space-x-1.5 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>Empty Vault Balance</span>
          </button>

          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Withdraw Company Interest</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500 text-white font-bold text-xs flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-white hover:text-slate-200 font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total 30-Day Interest Piled Up</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            GHS {totalPiledUp.toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Accumulated across active cycles
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Available for Company Withdrawal</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Vault className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-500 font-mono">
            GHS {availableVaultBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Net Liquidity in Company Vault
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Corporate Payouts</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-500 font-mono">
            GHS {totalApprovedWithdrawn.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Disbursed to Bank / MoMo
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Contributing Members</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-500 font-mono">
            {accounts.length} Clients
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Across Packages GH₵ 5 - 200
          </div>
        </div>

      </div>

      {/* Member-by-Member 30-Day Interest Accumulation Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Member-by-Member 30-Day Interest Pile-Up
            </h3>
            <p className="text-xs text-slate-500">
              Breakdown of 1-day interest commission earned from each member on 30/31-day cycle completion
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member or account..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Member Name</th>
                <th className="py-3 px-3">Account Number</th>
                <th className="py-3 px-3">Daily Package</th>
                <th className="py-3 px-3">Accumulation Period</th>
                <th className="py-3 px-3 text-right">Interest Piled Up</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Date Retained</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-bold font-sans text-slate-900 dark:text-white">
                    {rec.customerName}
                  </td>
                  <td className="py-3 px-3 text-slate-500">{rec.accountNumber}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20">
                      GH₵ {rec.packageAmount.toFixed(2)}/day
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 font-sans">{rec.period}</td>
                  <td className="py-3 px-3 text-right font-black text-emerald-500">
                    +GHS {rec.accumulatedAmount.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {rec.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{rec.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Company Interest Withdrawal History */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Corporate Interest Withdrawal Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Audit trail of all company interest withdrawals requested and approved by Super Admin
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">{withdrawals.length} Entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Reference No</th>
                <th className="py-3 px-3">Destination</th>
                <th className="py-3 px-3">Requested By</th>
                <th className="py-3 px-3">Approved By (Super Admin)</th>
                <th className="py-3 px-3 text-right">Amount (GHS)</th>
                <th className="py-3 px-3 text-center">Clearance Status</th>
                <th className="py-3 px-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {withdrawals.map((wd) => (
                <tr key={wd.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-bold text-amber-500">{wd.referenceNo}</td>
                  <td className="py-3 px-3 font-sans">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {wd.destinationType === 'COMPANY_BANK_ACCOUNT' && <Building2 className="w-3.5 h-3.5 text-blue-400" />}
                      {wd.destinationType === 'MTN_MOMO_MERCHANT' && <Smartphone className="w-3.5 h-3.5 text-amber-400" />}
                      {wd.destinationType === 'VAULT_CASH' && <Vault className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{wd.destinationType.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{wd.destinationDetails}</div>
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-400">
                    {wd.requestedBy.name} ({wd.requestedBy.role})
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-400">
                    {wd.approvedBy ? `${wd.approvedBy.name} (SUPER_ADMIN)` : <span className="text-amber-400 italic">Pending Super Admin Review</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white">
                    GHS {wd.amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      wd.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : wd.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}>
                      {wd.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{wd.requestedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in"
          onClick={() => {
            setIsWithdrawModalOpen(false);
            setIsDestinationDropdownOpen(false);
          }}
        >
          <div 
            className="max-w-md w-full max-h-[86vh] overflow-y-auto p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl text-white space-y-4 my-auto scrollbar-thin animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5 text-amber-500">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <PiggyBank className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Withdraw Company Interest</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 font-normal">Disburse corporate earnings to company account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWithdrawModalOpen(false);
                  setIsDestinationDropdownOpen(false);
                }}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Available Balance Pill */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-slate-950 border border-amber-500/40 flex items-center justify-between shadow-inner">
              <div className="flex items-center space-x-2">
                <Vault className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Available Vault Balance</span>
              </div>
              <span className="text-base font-black font-mono text-emerald-400">
                GH₵ {availableVaultBalance.toFixed(2)}
              </span>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-200 block mb-1 text-xs">Amount to Withdraw (GHS) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-mono font-bold text-amber-500 text-base">GH₵</span>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="1"
                    max={availableVaultBalance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-black text-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-inner"
                  />
                </div>
              </div>

              {/* Custom High-Contrast Dropdown */}
              <div className="relative">
                <label className="font-bold text-slate-200 block mb-1 text-xs">Destination Type *</label>
                <button
                  type="button"
                  onClick={() => setIsDestinationDropdownOpen(!isDestinationDropdownOpen)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border-2 border-slate-700 hover:border-amber-500 text-left flex items-center justify-between transition-all cursor-pointer shadow-inner group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                      {React.createElement(
                        DESTINATION_OPTIONS.find((o) => o.type === destinationType)?.icon || Building2,
                        { className: 'w-4 h-4 text-amber-400' }
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">
                        {DESTINATION_OPTIONS.find((o) => o.type === destinationType)?.label}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {DESTINATION_OPTIONS.find((o) => o.type === destinationType)?.desc}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDestinationDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
                </button>

                {/* Floating Options Menu */}
                {isDestinationDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    {DESTINATION_OPTIONS.map((opt) => {
                      const isSelected = destinationType === opt.type;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => {
                            setDestinationType(opt.type);
                            setDestinationDetails(opt.defaultDetails);
                            setIsDestinationDropdownOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                              : 'bg-slate-950/90 hover:bg-slate-800 text-white hover:text-amber-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-400'}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className={`text-xs font-bold ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                                {opt.label}
                              </div>
                              <div className={`text-[10px] ${isSelected ? 'text-slate-900/80' : 'text-slate-400'}`}>
                                {opt.desc}
                              </div>
                            </div>
                          </div>

                          {isSelected && <Check className="w-4 h-4 text-slate-950 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-200 block mb-1 text-xs">Destination Account Details *</label>
                <input
                  required
                  type="text"
                  value={destinationDetails}
                  onChange={(e) => setDestinationDetails(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-500 shadow-inner"
                />
              </div>

              <div>
                <label className="font-bold text-slate-200 block mb-1 text-xs">Purpose / Administrative Remarks</label>
                <textarea
                  value={withdrawRemarks}
                  onChange={(e) => setWithdrawRemarks(e.target.value)}
                  placeholder="e.g. End-of-month management dividend / operational logistics"
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-amber-500 shadow-inner"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                <div>
                  <span className="font-bold text-amber-300">Super Admin Clearance Notice:</span> This request will be queued in the Super Admin Approvals Hub before funds are disbursed.
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsWithdrawModalOpen(false);
                    setIsDestinationDropdownOpen(false);
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-colors cursor-pointer border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Confirm Empty Vault Modal */}
      {isConfirmEmptyOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsConfirmEmptyOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 text-rose-500">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Empty Interest Vault?</h3>
                <p className="text-xs text-slate-400">Reset Vault Balance to GHS 0.00</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Current Vault Balance:</span>
                <span className="font-extrabold text-amber-400 font-mono">GHS {availableVaultBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Target Vault Balance:</span>
                <span className="font-extrabold text-emerald-400 font-mono">GHS 0.00</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                This will clear all accrued company interest records and reset net vault liquidity across all connected devices.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmEmptyOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmptyVault}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-600/20 cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Empty</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
