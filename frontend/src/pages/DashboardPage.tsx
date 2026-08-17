import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '../components/ui/StatCard';
import { LoanCalculatorWidget } from '../components/ui/LoanCalculatorWidget';
import { StaffInfoPopupModal } from '../components/ui/StaffInfoPopupModal';
import { 
  getStoredCustomers, 
  getStoredAccounts, 
  getStoredLoans, 
  getStoredTransactions, 
  getStoredCompanyInterest, 
  getStoredCompanyWithdrawals, 
  getStoredApprovals 
} from '../services/api';
import { useRealtimeSync } from '../services/realtimeSync';
import { useAuth } from '../contexts/AuthContext';
import { SAVINGS_PACKAGES } from '../types';
import { 
  Users, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calculator, 
  Clock, 
  Building2, 
  TrendingUp, 
  ShieldCheck,
  CalendarCheck,
  PiggyBank,
  Coins,
  Shield,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null);

  const [customers, setCustomers] = useState(getStoredCustomers());
  const [accounts, setAccounts] = useState(getStoredAccounts());
  const [loans, setLoans] = useState(getStoredLoans());
  const [transactions, setTransactions] = useState(getStoredTransactions());
  const [interestRecords, setInterestRecords] = useState(getStoredCompanyInterest());
  const [withdrawals, setWithdrawals] = useState(getStoredCompanyWithdrawals());
  const [approvals, setApprovals] = useState(getStoredApprovals());

  // Real-time multi-device subscription
  useRealtimeSync(() => {
    setCustomers(getStoredCustomers());
    setAccounts(getStoredAccounts());
    setLoans(getStoredLoans());
    setTransactions(getStoredTransactions());
    setInterestRecords(getStoredCompanyInterest());
    setWithdrawals(getStoredCompanyWithdrawals());
    setApprovals(getStoredApprovals());
  });

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;
  const totalInterestPiledUp = interestRecords.reduce((sum, r) => sum + r.accumulatedAmount, 0);
  const totalApprovedWithdrawn = withdrawals
    .filter((w) => w.status === 'APPROVED')
    .reduce((sum, w) => sum + w.amount, 0);
  const availableVaultBalance = Math.max(0, totalInterestPiledUp - totalApprovedWithdrawn);

  const totalDepositsSum = transactions
    .filter((t) => t.type === 'DEPOSIT' || t.type === 'COMPANY_FEE_DEDUCTION')
    .reduce((sum, t) => sum + t.amount, 0);

  const chartData = [
    { month: 'Jan', deposits: 45000, interest: 1500, loans: 18000 },
    { month: 'Feb', deposits: 52000, interest: 2200, loans: 22000 },
    { month: 'Mar', deposits: 61000, interest: 3100, loans: 30000 },
    { month: 'Apr', deposits: 58000, interest: 2900, loans: 25000 },
    { month: 'May', deposits: 72000, interest: 4200, loans: 40000 },
    { month: 'Jun', deposits: 84000, interest: 5400, loans: 48000 },
    { month: 'Jul', deposits: Math.max(96000, totalDepositsSum), interest: Math.max(6800, totalInterestPiledUp), loans: 55000 },
  ];

  const packagesDistribution = SAVINGS_PACKAGES.map((pkg) => ({
    rate: pkg,
    package: `GH₵ ${pkg}`,
    clients: accounts.filter((a) => (a.savingsPackage || a.dailyCycles?.[0]?.dailyTargetAmount) === pkg).length,
  }));

  return (
    <div className="space-y-8 pb-12">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-white shadow-xl">
        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            Executive Financial & Governance Overview
            <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
              ROLE: {currentUser?.role.replace(/_/g, ' ')}
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            E-RIKON Core Financial Management System • Real-Time Branch Operations & 30-Day Interest Vault
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-slate-800 px-4 py-2 rounded-xl text-xs border border-slate-700 font-mono flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Operational Day: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Pending Approvals Alert for Super Admin & Admin */}
      {pendingApprovalsCount > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/20 via-amber-500/10 to-slate-900 border border-rose-500/40 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-rose-500 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-rose-300">
                {pendingApprovalsCount} Pending Request(s) Awaiting Super Admin Clearance
              </div>
              <p className="text-xs text-slate-400">
                Staff role signups, corporate interest withdrawals, and loan credit approvals in queue.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/approvals')}
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap"
          >
            <span>Open Approvals Hub</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Customers"
          value={customers.length.toString()}
          subtitle="Verified Ghana Card Clients"
          change="+12.5%"
          changeType="positive"
          icon={Users}
          colorScheme="amber"
        />
        <StatCard
          title="Savings Balance"
          value={`GHS ${accounts.reduce((sum, a) => sum + a.availableBalance, 0).toFixed(2)}`}
          subtitle="31-Day Policy Scheme"
          change="+18.2%"
          changeType="positive"
          icon={Wallet}
          colorScheme="blue"
        />
        <StatCard
          title="Company Interest Piled Up"
          value={`GHS ${totalInterestPiledUp.toFixed(2)}`}
          subtitle="30-Day Member Retention"
          change="+24.0%"
          changeType="positive"
          icon={PiggyBank}
          colorScheme="emerald"
        />
        <StatCard
          title="ER-Fast Loan Portfolio"
          value={`GHS ${loans.reduce((sum, l) => sum + l.amountApproved, 0).toFixed(2)}`}
          subtitle="Tenor Interest Schedule"
          change="+15.0%"
          changeType="positive"
          icon={Calculator}
          colorScheme="purple"
        />
      </div>

      {/* Charts & Interactive Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Financial Inflow & Interest Curve */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Deposit Inflows vs. Company 30-Day Interest Accumulation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly trends for member savings collections and company retained management fees
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs font-mono">
              <span className="flex items-center gap-1 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Deposits
              </span>
              <span className="flex items-center gap-1 text-emerald-500">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Company Interest
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="depositsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="interestGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `GHS ${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="deposits" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#depositsGradient)" name="Deposits (GHS)" />
                <Area type="monotone" dataKey="interest" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#interestGradient)" name="Company Interest (GHS)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Loan Calculator Widget */}
        <div className="lg:col-span-4">
          <LoanCalculatorWidget />
        </div>

      </div>

      {/* Ghana Cedis Savings Packages Distribution Breakdown */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Ghana Cedis (GH₵) Savings Packages Adoption Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Distribution of active clients across the 12 standard packages (GH₵ 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
            12 Active Tiers
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2.5">
          {packagesDistribution.map((p) => (
            <button
              key={p.package}
              type="button"
              onClick={() => navigate(`/customers?package=${p.rate}`)}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-center space-y-1 hover:border-amber-500 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 hover:shadow-md hover:scale-[1.03] transition-all cursor-pointer group"
              title={`Click to view clients enrolled in GH₵ ${p.rate} package`}
            >
              <div className="text-xs font-black font-mono text-amber-500 group-hover:text-amber-600 dark:group-hover:text-amber-400">{p.package}</div>
              <div className="text-lg font-black text-slate-900 dark:text-white font-mono">{p.clients}</div>
              <div className="text-[10px] text-slate-400 group-hover:text-amber-500 font-medium transition-colors">
                {p.clients === 1 ? '1 Member' : `${p.clients} Members`}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Staff Info Modal */}
      <StaffInfoPopupModal
        staffName={selectedStaffName}
        onClose={() => setSelectedStaffName(null)}
      />

    </div>
  );
};
