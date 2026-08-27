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
  getStoredApprovals,
  getRegisteredUsers,
  deleteRegisteredUser
} from '../services/api';
import { useRealtimeSync } from '../services/realtimeSync';
import { useAuth } from '../contexts/AuthContext';
import { SAVINGS_PACKAGES, RegisteredUserRecord } from '../types';
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
  ArrowRight,
  CheckCircle2,
  XCircle,
  UserCheck,
  Trash2
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
  const [registeredStaff, setRegisteredStaff] = useState(getRegisteredUsers());
  const [userToDelete, setUserToDelete] = useState<RegisteredUserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete || !currentUser || !isSuperAdmin) return;
    setIsDeleting(true);
    try {
      await deleteRegisteredUser(userToDelete.id, currentUser);
      setRegisteredStaff(getRegisteredUsers());
      setDeleteFeedback(`🗑️ User ${userToDelete.firstName} ${userToDelete.lastName} (${userToDelete.email}) permanently removed.`);
      setUserToDelete(null);
      setTimeout(() => setDeleteFeedback(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Real-time multi-device subscription
  useRealtimeSync(() => {
    setCustomers(getStoredCustomers());
    setAccounts(getStoredAccounts());
    setLoans(getStoredLoans());
    setTransactions(getStoredTransactions());
    setInterestRecords(getStoredCompanyInterest());
    setWithdrawals(getStoredCompanyWithdrawals());
    setApprovals(getStoredApprovals());
    setRegisteredStaff(getRegisteredUsers());
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

  const currentMonthName = new Date().toLocaleString('en-US', { month: 'short' });
  const chartData = [
    { month: 'May', deposits: 0, interest: 0, loans: 0 },
    { month: 'Jun', deposits: 0, interest: 0, loans: 0 },
    { month: 'Jul', deposits: 0, interest: 0, loans: 0 },
    { 
      month: currentMonthName, 
      deposits: totalDepositsSum, 
      interest: totalInterestPiledUp, 
      loans: loans.reduce((sum, l) => sum + Number(l.amountApproved || l.amountRequested || 0), 0) 
    },
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
                {pendingApprovalsCount} Pending Request(s) Awaiting Clearance
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
          icon={Users}
          colorScheme="amber"
        />
        <StatCard
          title="Savings Balance"
          value={`GHS ${accounts.reduce((sum, a) => sum + a.availableBalance, 0).toFixed(2)}`}
          subtitle="31-Day Policy Scheme"
          icon={Wallet}
          colorScheme="blue"
        />
        <StatCard
          title="Company Interest Piled Up"
          value={`GHS ${totalInterestPiledUp.toFixed(2)}`}
          subtitle="30-Day Member Retention"
          icon={PiggyBank}
          colorScheme="emerald"
        />
        <StatCard
          title="ER-Fast Loan Portfolio"
          value={`GHS ${loans.reduce((sum, l) => sum + l.amountApproved, 0).toFixed(2)}`}
          subtitle="Tenor Interest Schedule"
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

      {/* Super Admin Executive Staff & Personnel Directory */}
      {currentUser?.role === 'SUPER_ADMIN' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-teal-50 text-[#0d9488] border border-teal-200">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Registered Personnel & Workstations Roster</span>
                  <span className="text-[10px] bg-teal-50 text-[#0d9488] px-2.5 py-0.5 rounded-full border border-teal-200 font-mono font-bold">
                    {registeredStaff.length} Accounts
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  All signed-up users across Super Admin, Admins, Tellers, Field Officers, Loan Officers & Auditors
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/approvals')}
              className="px-4 py-2 rounded-xl bg-[#0a3866] hover:bg-[#082d52] text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-slate-900/10 cursor-pointer transition-all w-fit"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Manage Approvals & Permissions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Role / Clearance</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Ghana Card</th>
                  <th className="py-2.5 px-3">Clearance Status</th>
                  {isSuperAdmin && <th className="py-2.5 px-3 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {registeredStaff.length > 0 ? (
                  registeredStaff.map((staff) => {
                    const isApproved = staff.isApproved || staff.status === 'ACTIVE';
                    const isSuperAdminRole = staff.role === 'SUPER_ADMIN';

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#0a3866] via-[#0d9488] to-[#166534] flex items-center justify-center text-white text-[11px] font-black shadow-xs">
                              {staff.firstName[0]}{staff.lastName[0]}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white font-sans text-xs flex items-center gap-1">
                                {staff.firstName} {staff.lastName}
                                {isSuperAdminRole && <ShieldCheck className="w-3 h-3 text-emerald-600 inline" />}
                              </div>
                              <div className="text-[9px] text-slate-400 font-mono">{staff.employeeId || 'STAFF'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isSuperAdminRole 
                              ? 'bg-[#0a3866] text-white border border-[#0e4b85]' 
                              : 'bg-teal-50 text-[#0d9488] border border-teal-200'
                          }`}>
                            {staff.role.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                          {staff.email}
                        </td>

                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {staff.phone || '—'}
                        </td>

                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                          {staff.ghanaCard || '—'}
                        </td>

                        <td className="py-2.5 px-3">
                          {isApproved ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        {isSuperAdmin && (
                          <td className="py-2.5 px-3 text-center">
                            {isSuperAdminRole ? (
                              <span className="text-[10px] text-slate-400 font-sans italic">Primary Exec</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setUserToDelete(staff)}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[10px] transition-all cursor-pointer inline-flex items-center gap-1"
                                title="Permanently delete user"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                      No signed-up users registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Staff Info Modal */}
      <StaffInfoPopupModal
        staffName={selectedStaffName}
        onClose={() => setSelectedStaffName(null)}
      />

      {/* Super Admin Permanent User Deletion Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-rose-900/60 shadow-2xl text-white space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-500">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-extrabold text-base text-white">
                  Permanently Delete User Account
                </h3>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-900/50 space-y-1">
                <div className="text-rose-300 font-bold">⚠️ Warning: Irreversible Super Admin Action</div>
                <div className="text-slate-300 text-[11px]">
                  You are about to permanently remove this user account from E-RiKON ECFMS:
                </div>
                <div className="pt-2 font-mono text-xs text-white">
                  <div><strong>Name:</strong> {userToDelete.firstName} {userToDelete.lastName}</div>
                  <div><strong>Email:</strong> {userToDelete.email}</div>
                  <div><strong>Role:</strong> {userToDelete.role}</div>
                  <div><strong>Ghana Card:</strong> {userToDelete.ghanaCard || 'N/A'}</div>
                </div>
              </div>

              <p className="text-slate-400 text-[11px] leading-relaxed">
                Once deleted, this user will no longer be able to log in to any workstation. All associated pending approvals will be purged and an immutable audit log entry will be recorded.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeleting}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
