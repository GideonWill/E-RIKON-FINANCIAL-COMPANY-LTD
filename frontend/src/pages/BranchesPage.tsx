import React, { useState } from 'react';
import { getStoredBranches, saveStoredBranches, getStoredTransactions, getRegisteredUsers } from '../services/api';
import { useRealtimeSync } from '../services/realtimeSync';
import { Branch, Transaction } from '../types';
import {
  GitBranch,
  Building2,
  MapPin,
  Phone,
  ShieldCheck,
  DollarSign,
  Users,
  Search,
  Plus,
  ArrowRightLeft,
  X,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Lock,
  RefreshCw,
  FileText,
  UserCheck,
  Briefcase
} from 'lucide-react';

interface VaultTransferLog {
  id: string;
  sourceBranch: string;
  destBranch: string;
  amount: number;
  initiatedBy: string;
  timestamp: string;
  status: 'COMPLETED' | 'PENDING_APPROVAL';
}

export const BranchesPage: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>(() => getStoredBranches());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [transactions, setTransactions] = useState<Transaction[]>(getStoredTransactions());
  const [registeredUsers, setRegisteredUsers] = useState(() => getRegisteredUsers());

  // Real-time synchronization
  useRealtimeSync(() => {
    setBranches(getStoredBranches());
    setTransactions(getStoredTransactions());
    setRegisteredUsers(getRegisteredUsers());
  });

  // Notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [selectedBranchForVault, setSelectedBranchForVault] = useState<Branch | null>(null);
  const [newVaultLimit, setNewVaultLimit] = useState('');

  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [selectedBranchForRoster, setSelectedBranchForRoster] = useState<Branch | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState('');
  const [transferDestId, setTransferDestId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Transfer Logs
  const [transferLogs, setTransferLogs] = useState<VaultTransferLog[]>([
    {
      id: 'VTR-2026-001',
      sourceBranch: 'Accra Central Main Branch',
      destBranch: 'Kumasi Adum Branch',
      amount: 50000.0,
      initiatedBy: 'Kwame Mensah (Super Admin)',
      timestamp: '2026-08-08 14:30',
      status: 'COMPLETED',
    },
    {
      id: 'VTR-2026-002',
      sourceBranch: 'Accra Central Main Branch',
      destBranch: 'Takoradi Market Circle Branch',
      amount: 30000.0,
      initiatedBy: 'Kwame Mensah (Super Admin)',
      timestamp: '2026-08-09 09:15',
      status: 'COMPLETED',
    },
  ]);

  // Form State for New Branch
  const [newBranchData, setNewBranchData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    region: 'Greater Accra',
    phone: '',
    cashLimit: '200000',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter logic
  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.region.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = selectedRegion === 'ALL' || b.region === selectedRegion;
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'ACTIVE' && b.isActive) ||
      (selectedStatus === 'INACTIVE' && !b.isActive);
    return matchesSearch && matchesRegion && matchesStatus;
  });

  // Unique regions
  const availableRegions = Array.from(new Set(branches.map((b) => b.region)));

  // Aggregate stats
  const totalBranchesCount = branches.length;
  const activeBranchesCount = branches.filter((b) => b.isActive).length;
  const totalCashLimitSum = branches.reduce((sum, b) => sum + b.cashLimit, 0);

  // Handle Add Branch
  const handleAddBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchData.name || !newBranchData.code || !newBranchData.city) {
      alert('Please fill out the required branch fields.');
      return;
    }

    const newBranch: Branch = {
      id: `br-${Date.now()}`,
      code: newBranchData.code.toUpperCase(),
      name: newBranchData.name,
      address: newBranchData.address || `${newBranchData.city} Business Center`,
      city: newBranchData.city,
      region: newBranchData.region,
      phone: newBranchData.phone || '+233 30 000 0000',
      cashLimit: parseFloat(newBranchData.cashLimit) || 150000,
      isActive: true,
    };

    const updated = [newBranch, ...branches];
    setBranches(updated);
    saveStoredBranches(updated);
    setIsAddModalOpen(false);
    setNewBranchData({
      name: '',
      code: '',
      address: '',
      city: '',
      region: 'Greater Accra',
      phone: '',
      cashLimit: '200000',
    });
    showToast(`Branch "${newBranch.name}" registered successfully!`);
  };

  // Handle Vault Limit Update
  const handleUpdateVaultLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchForVault || !newVaultLimit) return;
    const numVal = parseFloat(newVaultLimit);
    if (isNaN(numVal) || numVal < 0) {
      alert('Please enter a valid cash limit amount.');
      return;
    }

    const updated = branches.map((b) =>
      b.id === selectedBranchForVault.id ? { ...b, cashLimit: numVal } : b
    );
    setBranches(updated);
    saveStoredBranches(updated);
    setIsVaultModalOpen(false);
    showToast(`Vault Cash Limit for ${selectedBranchForVault.name} updated to GHS ${numVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
  };

  // Handle Inter-Branch Transfer
  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSourceId || !transferDestId || !transferAmount) {
      alert('Please select both branches and specify a transfer amount.');
      return;
    }
    if (transferSourceId === transferDestId) {
      alert('Source and destination branches cannot be the same.');
      return;
    }

    const sourceBranch = branches.find((b) => b.id === transferSourceId);
    const destBranch = branches.find((b) => b.id === transferDestId);
    const amt = parseFloat(transferAmount);

    if (isNaN(amt) || amt <= 0) {
      alert('Invalid transfer amount.');
      return;
    }

    const newLog: VaultTransferLog = {
      id: `VTR-2026-${Math.floor(100 + Math.random() * 900)}`,
      sourceBranch: sourceBranch?.name || 'Main Vault',
      destBranch: destBranch?.name || 'Regional Vault',
      amount: amt,
      initiatedBy: 'Kwame Mensah (Super Admin)',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'COMPLETED',
    };

    setTransferLogs([newLog, ...transferLogs]);
    setIsTransferModalOpen(false);
    setTransferAmount('');
    setTransferNotes('');
    showToast(`Inter-branch cash transfer of GHS ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} completed!`);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-600 text-white shadow-2xl animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <GitBranch className="w-6 h-6" />
            </div>
            Branch Operations & Regional Governance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage multi-branch networks, daily vault cash limits, staff allocations, and inter-branch cash rebalancing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all active:scale-95"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Vault Transfer
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add New Branch
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Network Branches
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {totalBranchesCount}
            </span>
            <span className="text-xs font-semibold text-emerald-500">
              ({activeBranchesCount} Active)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Expanded across {availableRegions.length} regions</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Combined Vault Limit
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
              GHS {totalCashLimitSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Approved total cash ceiling limit</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Assigned Field Staff
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              36
            </span>
            <span className="text-xs font-semibold text-slate-400">Officers & Tellers</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Full operational deployment</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Liquidity Health Rate
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-500">98.4%</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              OPTIMAL
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Bank of Ghana compliance verified</p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by branch name, code, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-2xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Region:
            </span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
            >
              <option value="ALL">All Regions</option>
              {availableRegions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Status:
            </span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive / Under Audit</option>
            </select>
          </div>
        </div>
      </div>

      {/* Branch Cards Grid */}
      {filteredBranches.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Branches Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No branch matching your current search parameters was found. Try clearing filters or create a new branch.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedRegion('ALL');
              setSelectedStatus('ALL');
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBranches.map((b) => {
            const staffList = registeredUsers.filter(
              (u) => u.branchId === b.id || u.branch?.id === b.id || u.branch?.name === b.name
            );

            // Dynamic branch vault cash calculated from actual recorded branch transactions
            const branchTxs = transactions.filter((t) => t.recordedBy?.branchId === b.id);
            const branchDeposits = branchTxs.filter((t) => t.type === 'DEPOSIT').reduce((s, t) => s + t.amount, 0);
            const branchWithdrawals = branchTxs.filter((t) => t.type === 'WITHDRAWAL').reduce((s, t) => s + t.amount, 0);
            const branchVaultUsed = Math.max(0, branchDeposits - branchWithdrawals);
            const vaultUsagePercent = b.cashLimit > 0 ? Math.min(100, Math.round((branchVaultUsed / b.cashLimit) * 100)) : 0;

            return (
              <div
                key={b.id}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-5 relative overflow-hidden flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-500 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          {b.code}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          {b.region}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-2">
                        {b.name}
                      </h3>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        b.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {b.isActive ? 'ACTIVE' : 'MAINTENANCE'}
                    </span>
                  </div>

                  {/* Branch Location & Contact Info */}
                  <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">{b.address}, {b.city}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>{b.phone}</span>
                    </div>
                  </div>

                  {/* Vault Cash Capacity Meter */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Vault Limit Usage
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {vaultUsagePercent}% (GHS {branchVaultUsed.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          vaultUsagePercent > 80 ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${vaultUsagePercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Key Stats Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Max Cash Limit</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        GHS {b.cashLimit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase block">Active Staff</span>
                      <span className="font-bold text-amber-500 text-sm">
                        {staffList.length} Officers
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Quick Action Buttons */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedBranchForVault(b);
                      setNewVaultLimit(b.cashLimit.toString());
                      setIsVaultModalOpen(true);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    Limit
                  </button>

                  <button
                    onClick={() => {
                      setSelectedBranchForRoster(b);
                      setIsRosterModalOpen(true);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    Roster
                  </button>

                  <button
                    onClick={() => {
                      setTransferSourceId(b.id);
                      setIsTransferModalOpen(true);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
                    Fund
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inter-Branch Transfer Audit Log Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" />
            Inter-Branch Vault Cash Transfers & Rebalancing Log
          </h3>
          <span className="text-xs font-mono text-slate-400">Audited by Bank of Ghana Standard</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
                <th className="py-3 px-4">Transfer Reference</th>
                <th className="py-3 px-4">Source Branch</th>
                <th className="py-3 px-4">Destination Branch</th>
                <th className="py-3 px-4 text-right">Amount (GHS)</th>
                <th className="py-3 px-4">Initiated By</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
              {transferLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-amber-500">{log.id}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{log.sourceBranch}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{log.destBranch}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    GHS {log.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4">{log.initiatedBy}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{log.timestamp}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL 1: ADD NEW BRANCH --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                Register New Branch Location
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBranchSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Branch Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BR-KUM-04"
                    value={newBranchData.code}
                    onChange={(e) => setNewBranchData({ ...newBranchData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Region *
                  </label>
                  <select
                    value={newBranchData.region}
                    onChange={(e) => setNewBranchData({ ...newBranchData, region: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 font-semibold"
                  >
                    <option value="Greater Accra">Greater Accra</option>
                    <option value="Ashanti">Ashanti</option>
                    <option value="Western">Western</option>
                    <option value="Northern">Northern</option>
                    <option value="Central">Central</option>
                    <option value="Volta">Volta</option>
                    <option value="Eastern">Eastern</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tema Main Branch"
                  value={newBranchData.name}
                  onChange={(e) => setNewBranchData({ ...newBranchData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    City / Town *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tema"
                    value={newBranchData.city}
                    onChange={(e) => setNewBranchData({ ...newBranchData, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +233 30 222 9900"
                    value={newBranchData.phone}
                    onChange={(e) => setNewBranchData({ ...newBranchData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Community 1 Commercial Center, Highway Rd"
                  value={newBranchData.address}
                  onChange={(e) => setNewBranchData({ ...newBranchData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Cash Vault Limit (GHS)
                </label>
                <input
                  type="number"
                  min="50000"
                  step="10000"
                  value={newBranchData.cashLimit}
                  onChange={(e) => setNewBranchData({ ...newBranchData, cashLimit: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                >
                  Register Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADJUST VAULT LIMIT --- */}
      {isVaultModalOpen && selectedBranchForVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                Adjust Cash Vault Limit
              </h3>
              <button
                onClick={() => setIsVaultModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
              Updating vault limit for <strong className="font-bold">{selectedBranchForVault.name}</strong> ({selectedBranchForVault.code}).
            </div>

            <form onSubmit={handleUpdateVaultLimit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Approved Limit
                </label>
                <input
                  type="text"
                  disabled
                  value={`GHS ${selectedBranchForVault.cashLimit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono font-bold border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Cash Vault Ceiling (GHS) *
                </label>
                <input
                  type="number"
                  required
                  step="5000"
                  value={newVaultLimit}
                  onChange={(e) => setNewVaultLimit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervisory Reason / Audit Note
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Higher seasonal market collection volume approved by BoG Risk Officer"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsVaultModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md"
                >
                  Update Vault Limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: STAFF ROSTER --- */}
      {isRosterModalOpen && selectedBranchForRoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Assigned Staff Roster
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedBranchForRoster.name} ({selectedBranchForRoster.code})</p>
              </div>
              <button
                onClick={() => setIsRosterModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {(() => {
                const branchStaff = registeredUsers.filter(
                  (u) =>
                    u.branchId === selectedBranchForRoster.id ||
                    u.branch?.id === selectedBranchForRoster.id ||
                    u.branch?.name === selectedBranchForRoster.name
                );

                if (branchStaff.length === 0) {
                  return (
                    <div className="text-center py-8 text-xs text-slate-400 font-mono">
                      No staff members assigned to this branch yet.
                    </div>
                  );
                }

                return branchStaff.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 font-extrabold flex items-center justify-center">
                        {staff.firstName?.[0] || 'U'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {staff.firstName} {staff.lastName}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {staff.role.replace(/_/g, ' ')} • {staff.phone}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        staff.status === 'ACTIVE' || staff.isApproved
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}
                    >
                      {staff.status || (staff.isApproved ? 'ACTIVE' : 'PENDING')}
                    </span>
                  </div>
                ));
              })()}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsRosterModalOpen(false)}
                className="px-5 py-2 rounded-xl font-bold bg-slate-900 dark:bg-slate-800 text-white"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: INTER-BRANCH VAULT CASH TRANSFER --- */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                Inter-Branch Vault Cash Transfer
              </h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Source Branch *
                  </label>
                  <select
                    value={transferSourceId}
                    onChange={(e) => setTransferSourceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-semibold"
                  >
                    <option value="">Select Source</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Destination Branch *
                  </label>
                  <select
                    value={transferDestId}
                    onChange={(e) => setTransferDestId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-semibold"
                  >
                    <option value="">Select Destination</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Amount (GHS) *
                </label>
                <input
                  type="number"
                  required
                  step="1000"
                  placeholder="e.g. 25000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Purpose / Armored Vehicle Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of Week Regional Vault Balancing (Ref: CIT-9082)"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                >
                  Execute Cash Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
