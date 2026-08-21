import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import logoImg from '../../assets/logo.png';
import { RoleName } from '../../types';
import { 
  Sparkles, 
  Users, 
  Wallet, 
  Landmark, 
  Smartphone, 
  Calculator, 
  FileSpreadsheet, 
  CalendarCheck2, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  PiggyBank, 
  Compass, 
  Check, 
  Clock, 
  Printer, 
  Coins,
  ShieldAlert,
  Building2,
  Receipt,
  FileCheck,
  TrendingUp,
  UserCheck,
  Search,
  KeyRound,
  Shield
} from 'lucide-react';

interface AppWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WalkthroughStep {
  title: string;
  subtitle: string;
  badge: string;
  icon: any;
  color: string;
  content: React.ReactNode;
}

export const AppWalkthroughModal: React.FC<AppWalkthroughModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);

  // Reset to step 0 when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen || !currentUser) return null;

  const role = currentUser.role;

  // Build tailored steps based on the user's specific role
  const getRoleSteps = (): WalkthroughStep[] => {
    switch (role) {
      case 'SUPER_ADMIN':
        return [
          {
            title: `Welcome, Super Admin ${currentUser.firstName}!`,
            subtitle: 'Executive Master Governance & Institutional Clearance Hub',
            badge: 'Super Admin Overview',
            icon: ShieldCheck,
            color: 'from-[#0a3866] via-[#0d9488] to-[#166534]',
            content: (
              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  As <strong>Super Admin</strong>, you hold master administrative clearance over all branches, personnel, credit facilities, and financial ledgers across E-RiKON Financial Company PLC.
                </p>
                <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 space-y-2">
                  <div className="font-bold text-[#0d9488] flex items-center gap-1.5 text-xs">
                    <Shield className="w-4 h-4" />
                    <span>Master Operational Authority</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    You can approve newly registered staff accounts, authorize high-value transactions, review branch credit portfolios, configure system cash limits, and inspect immutable audit logs.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Governance Scope</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Global All-Branch Authority</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Security Protocol</span>
                    <span className="font-bold text-emerald-600">Zero-Data-Disruption</span>
                  </div>
                </div>
              </div>
            ),
          },
          {
            title: 'Personnel Clearance & Account Management',
            subtitle: 'One-Click Staff Clearances, User Roster & Account Deletion',
            badge: 'Access Governance',
            icon: UserCheck,
            color: 'from-blue-600 to-teal-600',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  All newly registered staff members require Super Admin authorization before accessing their workstations:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Approvals Hub:</strong> Review pending staff sign-ups, verify Ghana Card numbers, and approve with custom remarks.
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">User Deletion & Revocation:</strong> Safely delete staff accounts you no longer need with instant confirmation while company records stay 100% intact.
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            title: 'Global Daily Savings & 31-Day Company Vault',
            subtitle: 'Monitoring Customer Deposits (GH₵ 5 – GH₵ 200) & Retention Revenue',
            badge: 'Financial Oversight',
            icon: PiggyBank,
            color: 'from-amber-600 to-teal-600',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Track microfinance savings cycles and the company's earned revenue:
                </p>
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1.5">
                  <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-xs">
                    <Coins className="w-4 h-4" />
                    <span>Day 31 Company Retention Vault</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    The system automatically calculates 1-day management fee deductions on Day 31 for each package (GH₵ 5 – GH₵ 200), channeling accrued fees into the institutional reserve vault.
                  </p>
                </div>
              </div>
            ),
          },
          {
            title: 'End of Day (EOD) Institutional Sign-Off & Audit',
            subtitle: 'Multi-Branch Cash Balancing, Till Reconciliation & Immutable Audit Trail',
            badge: 'Daily Close',
            icon: CalendarCheck2,
            color: 'from-[#0a3866] via-[#0d9488] to-[#166534]',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  At the close of business, review multi-role operational summaries:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CalendarCheck2 className="w-4 h-4 text-[#0d9488]" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Multi-Workstation EOD Close:</strong> Tellers till variance, field mobile remits, and loan recoveries.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Immutable Security Audit Trail:</strong> Every single ledger alteration is timestamped and permanently logged.
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
        ];

      case 'TELLER':
        return [
          {
            title: `Welcome, Teller ${currentUser.firstName}!`,
            subtitle: 'Counter Cash Operations & Cashier Till Workstation',
            badge: 'Teller Workstation',
            icon: Landmark,
            color: 'from-amber-600 via-orange-600 to-teal-700',
            content: (
              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Welcome to the <strong>Teller Station</strong> at <strong className="text-slate-900 dark:text-white">{currentUser.branch?.name || 'Accra Central'}</strong>. Your workstation is built for fast, secure counter cash deposits, withdrawals, and customer lookups.
                </p>
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 space-y-1.5">
                  <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-xs">
                    <Landmark className="w-4 h-4" />
                    <span>Physical Cashier Till Management</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Track your opening drawer balance, accept cash deposits, process counter withdrawals against Ghana Card verification, and keep your till balanced throughout the day.
                  </p>
                </div>
              </div>
            ),
          },
          {
            title: 'Processing Deposits & Counter Withdrawals',
            subtitle: 'Fast Account Lookup, Daily Savings Tiers & Real-Time Balance Updating',
            badge: 'Counter Transactions',
            icon: Wallet,
            color: 'from-emerald-600 to-teal-700',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Execute high-speed counter transactions seamlessly:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Customer Account Lookup:</strong> Search clients instantly by Account Number (<code>ACC-100XXX</code>), Phone Number, or Ghana Card PIN.
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Package Selection:</strong> Credit daily savings (GH₵ 5 – GH₵ 200) with automatic cycle progression (Days 1–31).
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            title: 'Paperless Digital Receipts & Printing',
            subtitle: 'Instant Official Receipts with Validation Code & Company Seal',
            badge: 'Receipt Issuance',
            icon: Receipt,
            color: 'from-blue-600 to-indigo-700',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Every counter deposit and withdrawal produces an official stamped receipt:
                </p>
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 space-y-1.5">
                  <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 text-xs">
                    <Printer className="w-4 h-4" />
                    <span>Instant POS & Standard Thermal Printing</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Print verified customer transaction receipts or send paperless receipt summaries via SMS/WhatsApp directly to the customer's mobile phone.
                  </p>
                </div>
              </div>
            ),
          },
          {
            title: 'Daily Teller Till Balancing & Evening Close',
            subtitle: 'Reconciling Cash Drawer, Physical Variance & Supervisor Handover',
            badge: 'End of Day Balancing',
            icon: CalendarCheck2,
            color: 'from-[#0a3866] via-[#0d9488] to-[#166534]',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  At the end of your shift:
                </p>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <Clock className="w-4 h-4 text-[#0d9488]" />
                    <span>Cash Drawer Till Balancing</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Go to <strong>End of Day Close</strong> in the sidebar. Enter physical cash counted in your till to compute net daily variance, print your balancing slip, and hand over vault balances cleanly.
                  </p>
                </div>
              </div>
            ),
          },
        ];

      case 'FIELD_OFFICER':
        return [
          {
            title: `Welcome, Field Officer ${currentUser.firstName}!`,
            subtitle: 'Mobile Onsite Daily Savings & Route Collection Workstation',
            badge: 'Mobile Field Operations',
            icon: Smartphone,
            color: 'from-blue-600 via-teal-600 to-emerald-700',
            content: (
              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Welcome to the <strong>Mobile Field Collection Workstation</strong>! You are equipped to collect daily microfinance savings on-the-go from shop owners, market traders, and route clients.
                </p>
                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 space-y-1.5">
                  <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 text-xs">
                    <Smartphone className="w-4 h-4" />
                    <span>Swipe-Friendly Mobile Workstation</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Swipe right on mobile to pull your navigation menu anytime. Collect deposits rapidly and track your daily collection total directly on your device.
                  </p>
                </div>
              </div>
            ),
          },
          {
            title: '12 Daily Savings Packages & The 31-Day Splitter',
            subtitle: 'Standardized Rates (GH₵ 5 – GH₵ 200) & Automated Cycle Tracking',
            badge: 'Daily Splitter',
            icon: PiggyBank,
            color: 'from-emerald-600 to-teal-700',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  How customer savings cycles work on the field:
                </p>
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 space-y-1.5">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                    <Coins className="w-4 h-4" />
                    <span>Days 1–30 Client Savings & Day 31 Retention</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Each daily deposit records the client's progress towards their 31-day cycle. Days 1–30 build customer savings, while Day 31 fulfills the company's monthly account management fee.
                  </p>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 text-center font-mono text-[10px]">
                  {[5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200].map((pkg) => (
                    <div key={pkg} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-[#0d9488]">
                      GH₵ {pkg}
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
          {
            title: 'Onsite Customer Onboarding & Instant Verification',
            subtitle: 'Registering New Clients On-the-Go with Ghana Card Capture',
            badge: 'Onsite Onboarding',
            icon: Users,
            color: 'from-purple-600 to-indigo-700',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Register new clients directly from their shops or market stalls:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Ghana Card Capture:</strong> Enter client PIN, name, and phone number for immediate KYC compliance.
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Assigned Daily Package:</strong> Attach the customer to their preferred daily package rate to begin daily collection immediately.
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            title: 'Evening Remittance & Branch Cash Hand-In',
            subtitle: 'Reconciling Route Collections & Remitting Physical Cash to Vault',
            badge: 'Field Close',
            icon: CalendarCheck2,
            color: 'from-[#0a3866] via-[#0d9488] to-[#166534]',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  At the conclusion of your field route:
                </p>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <Clock className="w-4 h-4 text-[#0d9488]" />
                    <span>Field Collection Remittance</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Open <strong>End of Day Close</strong> to view your total daily route collections. Remit the physical cash to the branch cashier/vault officer to receive your official handover clearance.
                  </p>
                </div>
              </div>
            ),
          },
        ];

      case 'LOAN_OFFICER':
        return [
          {
            title: `Welcome, Loan Officer ${currentUser.firstName}!`,
            subtitle: 'ER-Fast Microfinance Credit Desk & Portfolio Origination',
            badge: 'Credit Desk',
            icon: Calculator,
            color: 'from-purple-600 via-indigo-600 to-teal-700',
            content: (
              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Welcome to the <strong>ER-Fast Loans Desk</strong>! Your workstation provides powerful tools for credit appraisal, automated interest calculation, amortization schedule generation, and repayment monitoring.
                </p>
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 space-y-1.5">
                  <div className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 text-xs">
                    <Calculator className="w-4 h-4" />
                    <span>Automated Tiered Tenor Calculator</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Instantly compute flat interest rates and monthly/weekly repayment amounts based on Bank of Ghana compliant microfinance loan tenors.
                  </p>
                </div>
              </div>
            ),
          },
          {
            title: 'Tiered Tenor Rates & Credit Calculator',
            subtitle: '10% (1M), 15% (2M), 25% (3M), 30% (4M+) Flat Interest Tiers',
            badge: 'Interest Calculation',
            icon: TrendingUp,
            color: 'from-indigo-600 to-teal-700',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Standard loan interest rates across tenors:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-[11px]">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50">
                    <span className="text-[10px] text-slate-400 block font-sans">1 Month</span>
                    <span className="font-bold text-purple-700 dark:text-purple-300">10% Flat</span>
                  </div>
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50">
                    <span className="text-[10px] text-slate-400 block font-sans">2 Months</span>
                    <span className="font-bold text-purple-700 dark:text-purple-300">15% Flat</span>
                  </div>
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50">
                    <span className="text-[10px] text-slate-400 block font-sans">3 Months</span>
                    <span className="font-bold text-purple-700 dark:text-purple-300">25% Flat</span>
                  </div>
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50">
                    <span className="text-[10px] text-slate-400 block font-sans">4+ Months</span>
                    <span className="font-bold text-purple-700 dark:text-purple-300">30% Flat</span>
                  </div>
                </div>
              </div>
            ),
          },
          {
            title: 'Origination, Guarantors & Super Admin Clearance',
            subtitle: 'Submitting Applications for Clearance & Immediate Disbursement',
            badge: 'Approval Workflow',
            icon: FileCheck,
            color: 'from-teal-600 to-emerald-700',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Originate loans with complete documentation:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Guarantor & Collateral:</strong> Capture guarantor Ghana Card and contact details with business location data.
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Super Admin Clearance:</strong> Applications submit in real time to the Super Admin approvals hub for fast disbursement authorization.
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
        ];

      case 'BRANCH_ADMIN':
      case 'ADMIN':
        return [
          {
            title: `Welcome, Branch Administrator ${currentUser.firstName}!`,
            subtitle: 'Branch Governance, Operations Oversight & Vault Coordination',
            badge: 'Branch Operations',
            icon: Building2,
            color: 'from-emerald-600 via-teal-600 to-[#0a3866]',
            content: (
              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  As <strong>Branch Administrator</strong> for <strong className="text-slate-900 dark:text-white">{currentUser.branch?.name || 'Accra Central Main Branch'}</strong>, you oversee branch tellers, field officers, customer onboarding, and local vault liquidity.
                </p>
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 space-y-1.5">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                    <Building2 className="w-4 h-4" />
                    <span>Branch Workstation Authority</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Verify client Ghana Card KYC dossiers, review daily collections, supervise teller drawers, and perform branch daily close reconciliations.
                  </p>
                </div>
              </div>
            ),
          },
          {
            title: 'Customer 360 & Daily Savings Packages',
            subtitle: 'Managing Client Profiles, 12 Package Tiers & Statement Inquiries',
            badge: 'Customer Management',
            icon: Users,
            color: 'from-teal-600 to-emerald-700',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Full access to customer accounts and statements:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <Users className="w-4 h-4 text-[#0d9488]" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Customer 360 Hub:</strong> Search and inspect accounts by Ghana Card, Name, or Account Number.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <Printer className="w-4 h-4 text-emerald-600" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Financial Statements:</strong> Generate official printable PDF statements and WhatsApp statement dispatches.
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            title: 'Branch End of Day (EOD) Operations',
            subtitle: 'Reconciling Teller Tills, Field Collections & Vault Balances',
            badge: 'Branch EOD Close',
            icon: CalendarCheck2,
            color: 'from-[#0a3866] via-[#0d9488] to-[#166534]',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Daily branch balancing console:
                </p>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <Clock className="w-4 h-4 text-[#0d9488]" />
                    <span>Consolidated Daily Balancing</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Verify all physical cash inflows from tellers and field officers against withdrawals to ensure zero till variance before locking the evening vault.
                  </p>
                </div>
              </div>
            ),
          },
        ];

      case 'AUDITOR':
      default:
        return [
          {
            title: `Welcome, Auditor ${currentUser.firstName}!`,
            subtitle: 'Immutable Security Trail & General Ledger Compliance Hub',
            badge: 'Internal Audit',
            icon: ShieldAlert,
            color: 'from-slate-800 via-teal-900 to-emerald-950',
            content: (
              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  As an <strong>Institutional Auditor</strong>, you have read-only inspection clearance across all branches, double-entry financial ledgers, user activities, and security logs.
                </p>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <ShieldAlert className="w-4 h-4 text-emerald-500" />
                    <span>Immutable Audit Trail</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Every transaction, user registration, deletion, and authorization event is permanently cryptographically logged with user identity, timestamp, and IP address.
                  </p>
                </div>
              </div>
            ),
          },
          {
            title: 'Double-Entry General Ledger & Statements',
            subtitle: 'Transaction Verification, Journal Balancing & CSV/PDF Compliance Export',
            badge: 'Ledger Audit',
            icon: FileSpreadsheet,
            color: 'from-[#0a3866] to-teal-800',
            content: (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Verify institutional balancing and compliance:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <FileSpreadsheet className="w-4 h-4 text-[#0d9488]" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">General Ledger Inspection:</strong> Inspect double-entry accounting records across all savings packages and loan desks.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <CalendarCheck2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">End of Day (EOD) Audit:</strong> Verify daily till variances and executive clearance stamps.
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
        ];
    }
  };

  const steps = getRoleSteps();
  const currentStepData = steps[currentStep] || steps[0];
  const StepIcon = currentStepData.icon;
  const isLastStep = currentStep === steps.length - 1;

  const handleFinishTour = () => {
    if (currentUser) {
      localStorage.setItem(`erikon_tour_completed_${currentUser.id || currentUser.email}`, 'true');
    }
    onClose();
  };

  const handleNextStep = () => {
    if (isLastStep) {
      handleFinishTour();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative overflow-hidden my-auto max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header with Logo, Role Badge & Step Counter */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center space-x-2.5">
            <img src={logoImg} alt="E-RiKON Logo" className="h-7 w-auto object-contain" />
            <div>
              <span className="text-[10px] font-mono text-[#0d9488] font-bold block uppercase tracking-wider">
                {currentUser.role.replace(/_/g, ' ')} WORKSTATION GUIDE
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
            title="Close Walkthrough"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Banner */}
        <div className={`p-4 rounded-2xl bg-gradient-to-r ${currentStepData.color} text-white space-y-1 shadow-lg shadow-teal-950/10`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
              {currentStepData.badge}
            </span>
            <StepIcon className="w-5 h-5 text-white/90" />
          </div>
          <h3 className="text-base font-extrabold tracking-tight pt-1">
            {currentStepData.title}
          </h3>
          <p className="text-[11px] text-white/80 font-medium">
            {currentStepData.subtitle}
          </p>
        </div>

        {/* Step Content */}
        <div className="min-h-[140px] flex flex-col justify-center">
          {currentStepData.content}
        </div>

        {/* Step Progress Dots */}
        <div className="flex items-center justify-center space-x-1.5 pt-1">
          {steps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentStep(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentStep 
                  ? 'w-6 bg-[#0d9488]' 
                  : 'w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-400'
              }`}
              title={`Go to Step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={currentStep === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              currentStep === 0 
                ? 'opacity-30 cursor-not-allowed text-slate-400' 
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleFinishTour}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium px-2 py-1 cursor-pointer"
            >
              Skip
            </button>

            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#0d9488] via-[#10b981] to-[#166534] hover:opacity-95 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-teal-900/10 cursor-pointer"
            >
              <span>{isLastStep ? 'Get Started' : 'Next Step'}</span>
              {isLastStep ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
