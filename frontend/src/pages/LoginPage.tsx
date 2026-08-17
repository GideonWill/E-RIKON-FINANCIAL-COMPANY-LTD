import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { resetToCleanLiveState } from '../services/api';
import { RoleName } from '../types';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { GhanaCardInput } from '../components/ui/GhanaCardInput';
import { GhanaPhoneInput, isValidGhanaPhone } from '../components/ui/GhanaPhoneInput';
import logoImg from '../assets/logo.jpeg';
import { 
  Building2, 
  ShieldCheck, 
  Landmark, 
  Smartphone, 
  Calculator, 
  FileCheck, 
  LogIn, 
  Eye, 
  EyeOff, 
  ArrowRight,
  Shield,
  UserPlus,
  UserCheck,
  CheckCircle2,
  Lock,
  RotateCcw,
  Sparkles,
  Trash2,
  RefreshCw,
  Share2,
  Copy,
  Check,
  Wifi,
  Laptop
} from 'lucide-react';
import { 
  pullCloudToLocal, 
  pushLocalToCloud, 
  exportPairingBundle, 
  importPairingBundle, 
  getLastSyncTime 
} from '../services/cloudSync';

export const LoginPage: React.FC = () => {
  const { login, signupRole } = useAuth();
  const navigate = useNavigate();

  // Tab State: 'signin' | 'signup'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  // Sign In State
  const [selectedRole, setSelectedRole] = useState<RoleName>('SUPER_ADMIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Multi-Device Cloud Sync State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedPairingCode, setCopiedPairingCode] = useState(false);
  const [importCodeInput, setImportCodeInput] = useState('');

  // Sign Up State
  const [signupRoleType, setSignupRoleType] = useState<RoleName>('SUPER_ADMIN');
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupGhanaCard, setSignupGhanaCard] = useState('');
  const [signupEmployeeId, setSignupEmployeeId] = useState('');
  const [signupBranch, setSignupBranch] = useState('Accra Central Main Branch');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupSuccessMsg, setSignupSuccessMsg] = useState<string | null>(null);

  const rolesList: { role: RoleName; label: string; icon: any; color: string; desc: string; badgeColor: string }[] = [
    {
      role: 'SUPER_ADMIN',
      label: 'Super Admin Portal',
      icon: ShieldCheck,
      color: 'from-rose-500 to-rose-600',
      badgeColor: 'bg-rose-500/20 border-rose-500/30 text-rose-400',
      desc: 'Exclusive Governance Authority: Final Approval for Staff, Loans, Interest Vault & Company Operations',
    },
    {
      role: 'ADMIN',
      label: 'Operations Admin Desk',
      icon: Shield,
      color: 'from-blue-600 to-indigo-600',
      badgeColor: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
      desc: 'Daily Operational Dispatch, Customer Oversight, Review Queue Preparation & System Analytics',
    },
    {
      role: 'BRANCH_ADMIN',
      label: 'Branch Admin Portal',
      icon: Building2,
      color: 'from-emerald-500 to-emerald-600',
      badgeColor: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
      desc: 'Branch Operations, Vault Cash Reconciliation & Daily Staff Cash Balances',
    },
    {
      role: 'TELLER',
      label: 'Teller Workstation',
      icon: Landmark,
      color: 'from-amber-500 to-amber-600',
      badgeColor: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
      desc: 'Physical Cash Deposit, Cash Withdrawal & Paperless Receipt Issuance Desk',
    },
    {
      role: 'FIELD_OFFICER',
      label: 'Field Officer Desk',
      icon: Smartphone,
      color: 'from-cyan-500 to-blue-600',
      badgeColor: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
      desc: '31-Day Daily Savings Collection, Ghana Cedis Packages (GH₵ 5-200) & Multi-Day Payment Splitter',
    },
    {
      role: 'LOAN_OFFICER',
      label: 'Loan Officer Desk',
      icon: Calculator,
      color: 'from-purple-500 to-purple-600',
      badgeColor: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
      desc: 'ER-Fast Loan Origination, Tiered Interest Quotes (10-30%) & Arrears Tracker',
    },
    {
      role: 'AUDITOR',
      label: 'Auditor Portal',
      icon: FileCheck,
      color: 'from-indigo-500 to-indigo-600',
      badgeColor: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
      desc: 'Immutable Double-Entry Financial Ledger, Compliance Audit & Company Fee Ledger',
    },
  ];

  const handleRoleSelect = (item: typeof rolesList[0]) => {
    setSelectedRole(item.role);
    setErrorMsg('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    const success = await login(email, password, selectedRole);
    setIsLoading(false);

    if (success) {
      let targetRole = selectedRole;
      try {
        const stored = localStorage.getItem('erikon_current_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.role) {
            targetRole = parsed.role;
          }
        }
      } catch {}

      switch (targetRole) {
        case 'SUPER_ADMIN':
        case 'ADMIN':
          navigate('/dashboard');
          break;
        case 'TELLER':
          navigate('/teller');
          break;
        case 'FIELD_OFFICER':
          navigate('/field-officer');
          break;
        case 'LOAN_OFFICER':
          navigate('/loans');
          break;
        case 'BRANCH_ADMIN':
          navigate('/branches');
          break;
        case 'AUDITOR':
          navigate('/audit');
          break;
        default:
          navigate('/dashboard');
      }
    } else {
      setErrorMsg('Invalid authentication credentials. If you registered on another device (e.g. laptop), tap "Pair / Sync Devices" above to instantly pull your accounts.');
    }
  };

  const handleManualCloudSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Connecting to Cloud Relay & Syncing...');
    try {
      await pushLocalToCloud();
      const pullSuccess = await pullCloudToLocal();
      if (pullSuccess) {
        setSyncStatusMsg('✅ Cloud Synchronization Complete! All devices are up to date.');
      } else {
        setSyncStatusMsg('✅ Local accounts pushed to Cloud Relay.');
      }
    } catch {
      setSyncStatusMsg('⚠️ Cloud Sync check finished.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  const handleCopyPairingCode = () => {
    const code = exportPairingBundle();
    navigator.clipboard.writeText(code);
    setCopiedPairingCode(true);
    setTimeout(() => setCopiedPairingCode(false), 3000);
  };

  const handleImportPairingCode = () => {
    if (!importCodeInput.trim()) return;
    const success = importPairingBundle(importCodeInput.trim());
    if (success) {
      setSyncStatusMsg('🎉 Device paired successfully! All staff accounts cloned to this phone/laptop.');
      setImportCodeInput('');
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } else {
      setSyncStatusMsg('❌ Invalid device pairing code. Please re-copy from the original device.');
    }
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupFirstName || !signupLastName || !signupEmail || !signupPhone || !signupGhanaCard || !signupPassword) {
      setErrorMsg('Please fill in all required registration fields.');
      return;
    }

    if (!isValidGhanaPhone(signupPhone)) {
      setErrorMsg('Phone number must be exactly 10 digits (e.g. 0241234567).');
      return;
    }

    const { user } = signupRole({
      firstName: signupFirstName,
      lastName: signupLastName,
      email: signupEmail,
      phone: signupPhone,
      role: signupRoleType,
      ghanaCard: signupGhanaCard,
      employeeId: signupEmployeeId,
      password: signupPassword,
    });

    // Auto populate signin form with registered credentials
    setSelectedRole(signupRoleType);
    setEmail(signupEmail);
    setPassword(signupPassword);

    setSignupSuccessMsg(
      `🎉 User account registered successfully for ${signupRoleType.replace(/_/g, ' ')} (${user.firstName} ${user.lastName}) with email: ${signupEmail}! You can now sign in immediately.`
    );

    // Clear form
    setSignupFirstName('');
    setSignupLastName('');
    setSignupEmail('');
    setSignupPhone('');
    setSignupGhanaCard('');
    setSignupEmployeeId('');
  };

  const handleResetData = () => {
    if (window.confirm('Are you sure you want to clear all created users, customers, and recorded monies? This will reset the entire system to a clean slate.')) {
      resetToCleanLiveState();
      setEmail('');
      setPassword('');
      setResetSuccessMsg('✅ All users, recorded monies, and accounts have been wiped clean! System reset to 0.');
      setTimeout(() => setResetSuccessMsg(null), 4000);
    }
  };

  return (
    <>
      {isLoading && (
        <LoadingScreen 
          message={`Authenticating ${selectedRole.replace(/_/g, ' ')} Workstation...`}
        />
      )}

      <div 
        className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-3 sm:p-6 lg:p-8 relative overflow-hidden font-sans"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 1rem), 2.75rem)',
        }}
      >
        
        {/* Ambient Glows */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 z-10 max-w-7xl w-full mx-auto">
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <img 
              src={logoImg} 
              alt="E-RIKON GROUP FINANCIAL COMPANY LTD Logo" 
              className="h-10 sm:h-12 w-auto object-contain rounded-lg shrink-0"
            />
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center justify-center sm:justify-start gap-2">
                E-RIKON <span className="text-amber-400 font-semibold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">ECFMS v2.0</span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400">
                E-RIKON GROUP FINANCIAL COMPANY LTD • Core Financial Management System
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl shrink-0 w-full sm:w-auto justify-center">
            <button
              onClick={() => { setActiveTab('signin'); setErrorMsg(''); setSignupSuccessMsg(null); }}
              className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
                activeTab === 'signin'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Role Sign In</span>
            </button>

            <button
              onClick={() => { setActiveTab('signup'); setErrorMsg(''); setResetSuccessMsg(null); }}
              className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
                activeTab === 'signup'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Register / Sign Up</span>
            </button>
          </div>
        </div>

        {/* Multi-Device Live Cloud Sync Ribbon */}
        <div className="max-w-7xl w-full mx-auto my-2 flex flex-wrap items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="flex items-center space-x-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-slate-300">Multi-Device Live Sync:</span>
            <span className="text-[11px] text-emerald-400 font-mono">
              {getLastSyncTime() ? `Synced at ${getLastSyncTime()}` : 'Cloud Relay Active'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualCloudSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Now'}</span>
            </button>

            <button
              type="button"
              onClick={() => { setIsSyncModalOpen(true); setSyncStatusMsg(null); }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Pair Phone & Laptop</span>
            </button>
          </div>
        </div>

        {/* Global Reset Notification */}
        {resetSuccessMsg && (
          <div className="max-w-4xl w-full mx-auto my-3 p-4 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs text-center shadow-lg animate-bounce">
            {resetSuccessMsg}
          </div>
        )}

        {/* Main Content Area */}
        <div className="my-6 z-10 max-w-7xl w-full mx-auto">
          
          {activeTab === 'signin' ? (
            /* ================= SIGN IN VIEW ================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              
              {/* Left Column: Role Selector Grid */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Authorized Workstation Scopes
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    Select Your Role or Enter Credentials
                  </h2>
                  <p className="text-xs text-slate-400">
                    Choose a role workstation below to auto-fill or enter your custom registered email & password.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {rolesList.map((item) => {
                    const isSelected = selectedRole === item.role;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.role}
                        onClick={() => handleRoleSelect(item)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden ${
                          isSelected
                            ? 'bg-slate-900 border-amber-500 shadow-xl ring-2 ring-amber-500/30'
                            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.color} text-white shadow-md`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                            {item.role.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="mt-3">
                          <h3 className="font-extrabold text-sm text-white">{item.label}</h3>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Sign In Form Box */}
              <div className="lg:col-span-5">
                <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-6">
                  
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Lock className="w-5 h-5 text-amber-400" />
                      <h3 className="text-lg font-extrabold text-white">Workstation Sign In</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Active Role: <span className="text-amber-400 font-bold font-mono">{selectedRole.replace(/_/g, ' ')}</span>
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                      {errorMsg}
                    </div>
                  )}

                  <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-300">Staff Email Address</label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. admin@erikon-group.com"
                        style={{ color: '#ffffff' }}
                        className="w-full mt-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-white !text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300">Workstation Password</label>
                      <div className="relative mt-1.5">
                        <input
                          required
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          style={{ color: '#ffffff' }}
                          className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white !text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-amber-400" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-sm flex items-center justify-center space-x-2 transition-all shadow-xl shadow-amber-500/20 cursor-pointer mt-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Authenticate & Enter Workstation</span>
                    </button>
                  </form>

                  <div className="pt-2 border-t border-slate-800 text-center">
                    <p className="text-[11px] text-slate-400">
                      Need to register a new staff account?{' '}
                      <button
                        onClick={() => setActiveTab('signup')}
                        className="text-amber-400 font-bold hover:underline cursor-pointer"
                      >
                        Sign Up Here
                      </button>
                    </p>
                  </div>

                </div>
              </div>

            </div>
          ) : (
            /* ================= SIGN UP VIEW ================= */
            <div className="max-w-3xl mx-auto">
              <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-white">Register for a Position / Role</h2>
                      <p className="text-xs text-slate-400">
                        Create an account for any company position. Create and sign in immediately.
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 w-fit">
                    Self-Onboarding
                  </span>
                </div>

                {signupSuccessMsg && (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium space-y-3">
                    <div className="flex items-start space-x-2 font-bold text-sm text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{signupSuccessMsg}</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('signin')}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400 transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md"
                    >
                      <span>Proceed to Sign In with New Account</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleSignupSubmit} className="space-y-5 text-xs">
                  
                  {/* Position Selection */}
                  <div>
                    <label className="font-bold text-slate-300">Select Position / Role to Apply For *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mt-1.5">
                      {rolesList.map((r) => {
                        const isChosen = signupRoleType === r.role;
                        return (
                          <button
                            type="button"
                            key={r.role}
                            onClick={() => setSignupRoleType(r.role)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isChosen
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-xs font-bold truncate">{r.label}</div>
                            <div className={`text-[10px] font-mono opacity-80 truncate ${isChosen ? 'text-slate-950' : 'text-amber-400'}`}>
                              {r.role}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Personal Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-300">First Name *</label>
                      <input
                        required
                        type="text"
                        value={signupFirstName}
                        onChange={(e) => setSignupFirstName(e.target.value)}
                        placeholder="e.g. Kwame"
                        style={{ color: '#ffffff' }}
                        className="w-full mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white !text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300">Last Name *</label>
                      <input
                        required
                        type="text"
                        value={signupLastName}
                        onChange={(e) => setSignupLastName(e.target.value)}
                        placeholder="e.g. Mensah"
                        style={{ color: '#ffffff' }}
                        className="w-full mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white !text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300">Email Address *</label>
                      <input
                        required
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="e.g. kwame.mensah@erikon-group.com"
                        style={{ color: '#ffffff' }}
                        className="w-full mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white !text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 flex justify-between">
                        <span>Phone Number (10 Digits) *</span>
                        <span className="text-[10px] text-amber-500 font-mono">e.g. 0241234567</span>
                      </label>
                      <div className="mt-1">
                        <GhanaPhoneInput
                          required
                          dark={true}
                          value={signupPhone}
                          onChange={(phone) => setSignupPhone(phone)}
                          placeholder="0241234567"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 flex justify-between">
                        <span>Ghana Card PIN *</span>
                        <span className="text-[10px] text-amber-500 font-mono">Format: GHA-XXXXXXXXX-X</span>
                      </label>
                      <div className="mt-1">
                        <GhanaCardInput
                          required
                          dark={true}
                          value={signupGhanaCard}
                          onChange={(formatted) => setSignupGhanaCard(formatted)}
                          placeholder="123456789-0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300">Employee ID (Optional)</label>
                      <input
                        type="text"
                        value={signupEmployeeId}
                        onChange={(e) => setSignupEmployeeId(e.target.value)}
                        placeholder="Auto-assigned if blank"
                        style={{ color: '#ffffff' }}
                        className="w-full mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white !text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300">Assigned Branch *</label>
                      <select
                        value={signupBranch}
                        onChange={(e) => setSignupBranch(e.target.value)}
                        style={{ color: '#ffffff' }}
                        className="w-full mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white !text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="Accra Central Main Branch">Accra Central Main Branch</option>
                        <option value="Kumasi Adum Branch">Kumasi Adum Branch</option>
                        <option value="Takoradi Market Circle Branch">Takoradi Market Circle Branch</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300">Workstation Password *</label>
                      <div className="relative mt-1">
                        <input
                          required
                          type={showSignupPassword ? 'text' : 'password'}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="••••••••••••"
                          style={{ color: '#ffffff' }}
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white !text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                          title={showSignupPassword ? 'Hide password' : 'View password'}
                        >
                          {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-amber-400" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-sm flex items-center justify-center space-x-2 transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Complete Registration & Activate Account</span>
                    </button>
                  </div>

                </form>

              </div>
            </div>
          )}

        </div>

        {/* Footer & Clean Reset Control */}
        <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 z-10 pt-4 border-t border-slate-900 text-center sm:text-left">
          <p className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} E-RIKON GROUP FINANCIAL COMPANY LTD. All rights reserved.
          </p>

          <button
            onClick={handleResetData}
            className="text-[11px] font-bold text-rose-400/80 hover:text-rose-300 flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer"
            title="Wipe all users, registered customers, accounts, and monies to start completely from scratch"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset All Records to Zero (0)</span>
          </button>
        </div>

        {/* Device Pairing & Multi-Device Cloud Sync Modal */}
        {isSyncModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
            <div className="max-w-lg w-full p-6 sm:p-7 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl space-y-5 my-auto">
              
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                    <Wifi className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-white">
                      Multi-Device Sync & Pairing
                    </h3>
                    <p className="text-xs text-slate-400">
                      Sync staff accounts between Laptop, Phone, and Tablets
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {syncStatusMsg && (
                <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold text-center">
                  {syncStatusMsg}
                </div>
              )}

              {/* Action 1: Cloud Relay Sync */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs text-white">Live Cloud Sync Relay</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                    Connected
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Pushes all registered staff credentials from this browser to the cloud relay, and pulls any accounts created on other devices.
                </p>
                <button
                  type="button"
                  onClick={handleManualCloudSync}
                  disabled={isSyncing}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-md"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Synchronizing with Cloud...' : 'Sync Cloud Accounts Now'}</span>
                </button>
              </div>

              {/* Action 2: Export from Laptop */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center space-x-2">
                  <Laptop className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-xs text-white">Step 1: Export from Laptop</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  On the device where you created the account, click below to copy your encrypted staff pairing code:
                </p>
                <button
                  type="button"
                  onClick={handleCopyPairingCode}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  {copiedPairingCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPairingCode ? '✓ Pairing Code Copied!' : 'Copy Device Pairing Code'}</span>
                </button>
              </div>

              {/* Action 3: Import on Phone */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-xs text-white">Step 2: Import on Phone</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  On your phone, paste the pairing code below to instantly clone your staff accounts:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={importCodeInput}
                    onChange={(e) => setImportCodeInput(e.target.value)}
                    placeholder="Paste pairing code here..."
                    style={{ color: '#ffffff' }}
                    className="flex-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white !text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleImportPairingCode}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all cursor-pointer shrink-0"
                  >
                    Pair Phone
                  </button>
                </div>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(false)}
                  className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Done / Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
};
