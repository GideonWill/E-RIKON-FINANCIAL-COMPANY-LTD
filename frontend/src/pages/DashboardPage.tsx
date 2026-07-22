import React, { useState } from 'react';
import { StatCard } from '../components/ui/StatCard';
import { LoanCalculatorWidget } from '../components/ui/LoanCalculatorWidget';
import { StaffInfoPopupModal } from '../components/ui/StaffInfoPopupModal';
import { MOCK_CUSTOMERS, MOCK_ACCOUNTS, MOCK_LOANS, MOCK_TRANSACTIONS } from '../services/api';
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
  CalendarCheck
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
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null);

  const chartData = [
    { month: 'Jan', deposits: 45000, withdrawals: 12000, loans: 18000 },
    { month: 'Feb', deposits: 52000, withdrawals: 15000, loans: 22000 },
    { month: 'Mar', deposits: 61000, withdrawals: 18000, loans: 30000 },
    { month: 'Apr', deposits: 58000, withdrawals: 14000, loans: 25000 },
    { month: 'May', deposits: 72000, withdrawals: 21000, loans: 40000 },
    { month: 'Jun', deposits: 84000, withdrawals: 24000, loans: 48000 },
    { month: 'Jul', deposits: 96000, withdrawals: 28000, loans: 55000 },
  ];

  return (
    <div className="space-y-8 pb-12">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-white shadow-xl">
        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            Executive Financial Overview
            <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
              PHYSICAL LEDGER MODE
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            E-RIKON Core Financial Management System • Real-Time Branch Operations
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-slate-800 px-4 py-2 rounded-xl text-xs border border-slate-700 font-mono flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Operational Day: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Customers"
          value={MOCK_CUSTOMERS.length.toString()}
          subtitle="Verified Ghana Card Clients"
          change="+12.5%"
          changeType="positive"
          icon={Users}
          colorScheme="amber"
        />
        <StatCard
          title="Savings Balance"
          value="GHS 148,500.00"
          subtitle="31-Day Policy Scheme"
          change="+18.2%"
          changeType="positive"
          icon={Wallet}
          colorScheme="blue"
        />
        <StatCard
          title="Today's Physical Deposits"
          value="GHS 14,250.00"
          subtitle="Teller & Field Collections"
          change="+8.4%"
          changeType="positive"
          icon={ArrowUpRight}
          colorScheme="emerald"
        />
        <StatCard
          title="ER-Fast Loan Portfolio"
          value="GHS 85,000.00"
          subtitle="Tenor Interest Schedule"
          change="+15.0%"
          changeType="positive"
          icon={Calculator}
          colorScheme="purple"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Financial Trend Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Monthly Deposits vs Loan Disbursements
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly growth in physical collections and credit advances (GHS)
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-semibold">
              <span className="flex items-center gap-1 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Deposits
              </span>
              <span className="flex items-center gap-1 text-emerald-500">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Loans
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLoans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415522" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="deposits" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorDeposits)" />
                <Area type="monotone" dataKey="loans" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorLoans)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loan Calculator Sidebar Widget */}
        <div>
          <LoanCalculatorWidget />
        </div>
      </div>

      {/* Recent Physical Transactions & Policy Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Operations Table */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Recent Physical Financial Operations
            </h3>
            <span className="text-xs font-semibold text-amber-500">Live Double-Entry Ledger</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Receipt / Ref</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Recorded By (Staff)</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {MOCK_TRANSACTIONS.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono text-slate-900 dark:text-slate-200 font-bold">
                      {tx.receiptNo}
                    </td>
                    <td className="py-3 px-3 text-slate-800 dark:text-slate-300">
                      {tx.account?.customer?.firstName} {tx.account?.customer?.lastName}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setSelectedStaffName(`${tx.recordedBy?.firstName} ${tx.recordedBy?.lastName}`)}
                        className="text-amber-500 hover:underline font-bold text-xs cursor-pointer flex items-center gap-1"
                        title="Click to view staff info popup"
                      >
                        {tx.recordedBy?.firstName} {tx.recordedBy?.lastName} ({tx.recordedBy?.role})
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-slate-900 dark:text-white font-mono">
                      GHS {tx.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* E-RIKON Special Policy Info Card */}
        <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-4 text-slate-800 dark:text-amber-100">
          <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
            <CalendarCheck className="w-5 h-5" />
            <h4 className="font-extrabold text-sm uppercase tracking-wider">31-Day Policy Standard</h4>
          </div>

          <p className="text-xs leading-relaxed text-slate-700 dark:text-amber-200">
            Clients contribute daily over a 31-day cycle. <strong>Days 1 to 30</strong> accumulate directly into the client's available savings balance.
            The <strong>31st day contribution</strong> (1 day worth) is automatically retained by E-RIKON GROUP FINANCIAL COMPANY LTD as the management & interest fee.
          </p>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/20 text-xs space-y-1">
            <div className="font-bold text-slate-900 dark:text-white">Active Cycle Rule</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Automatic fee retention triggers on the 31st deposit transaction.
            </p>
          </div>
        </div>

      </div>

      {/* Staff Info Popup Modal */}
      <StaffInfoPopupModal
        staffName={selectedStaffName}
        onClose={() => setSelectedStaffName(null)}
      />

    </div>
  );
};
