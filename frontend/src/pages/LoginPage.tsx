import React, { useState, useEffect } from 'react';
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
  Eye, 
  EyeOff, 
  Shield, 
  CheckCircle2, 
  Trash2,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

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

  // Auto-dismiss error & alert messages after 4 seconds
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (resetSuccessMsg) {
      const timer = setTimeout(() => setResetSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [resetSuccessMsg]);

  const rolesList: { role: RoleName; label: string; icon: any; color: string }[] = [
    { role: 'SUPER_ADMIN', label: 'Super Admin', icon: ShieldCheck, color: 'from-amber-500 to-amber-600' },
    { role: 'ADMIN', label: 'Operations Admin', icon: Shield, color: 'from-blue-500 to-indigo-600' },
    { role: 'BRANCH_ADMIN', label: 'Branch Admin', icon: Building2, color: 'from-emerald-500 to-emerald-600' },
    { role: 'TELLER', label: 'Teller Station', icon: Landmark, color: 'from-amber-500 to-yellow-600' },
    { role: 'FIELD_OFFICER', label: 'Field Officer', icon: Smartphone, color: 'from-emerald-600 to-teal-600' },
    { role: 'LOAN_OFFICER', label: 'Loan Officer', icon: Calculator, color: 'from-amber-600 to-orange-600' },
    { role: 'AUDITOR', label: 'Auditor Desk', icon: FileCheck, color: 'from-teal-500 to-emerald-700' },
  ];

  const handleRoleSelect = (item: typeof rolesList[0]) => {
    setSelectedRole(item.role);
    setErrorMsg('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    const result = await login(email, password, selectedRole);
    setIsLoading(false);

    if (result.success) {
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
      setErrorMsg(result.error || 'Invalid email or password. Please check your credentials and try again.');
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupFirstName || !signupLastName || !signupEmail || !signupPhone || !signupGhanaCard || !signupPassword) {
      setErrorMsg('Please fill in all required registration fields.');
      return;
    }

    if (!isValidGhanaPhone(signupPhone)) {
      setErrorMsg('Phone number must be exactly 10 digits (e.g. 0241234567).');
      return;
    }

    setIsLoading(true);
    try {
      const { user, isApproved } = await signupRole({
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

      if (isApproved) {
        setSignupSuccessMsg(
          `🎉 Super Admin account registered for ${user.firstName} ${user.lastName} (${signupEmail})! You can sign in immediately.`
        );
      } else {
        setSignupSuccessMsg(
          `✅ Registration submitted for ${signupRoleType.replace(/_/g, ' ')} (${user.firstName} ${user.lastName}). Awaiting Super Admin clearance. You can sign in to check live approval.`
        );
      }

      // Clear form
      setSignupFirstName('');
      setSignupLastName('');
      setSignupEmail('');
      setSignupPhone('');
      setSignupGhanaCard('');
      setSignupEmployeeId('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

      {/* Main Container - Warm Ambient Orange Backdrop matching Template */}
      <div className="min-h-screen lg:h-screen lg:max-h-screen w-full bg-[#f97316] bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c] flex flex-col justify-between p-3 sm:p-5 lg:p-6 select-none overflow-y-auto lg:overflow-hidden font-sans">
        
        {/* Global Reset Notification */}
        {resetSuccessMsg && (
          <div className="relative z-30 max-w-xl w-full mx-auto mb-2 p-2.5 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs text-center shadow-lg animate-bounce">
            {resetSuccessMsg}
          </div>
        )}

        {/* Central Master Card matching Template Image */}
        <div className="flex-1 flex items-center justify-center my-auto w-full max-w-4xl mx-auto">
          <div className="w-full bg-white rounded-[32px] sm:rounded-[36px] shadow-2xl shadow-orange-950/30 overflow-hidden flex flex-col md:flex-row min-h-[480px] border border-white/40">
            
            {/* ================= LEFT SIDE: 3D Glossy Spheres Banner ================= */}
            <div className="md:w-5/12 bg-gradient-to-br from-[#f97316] via-[#ea580c] to-[#c2410c] text-white p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden shrink-0">
              
              {/* Geometric Polygon Overlay Grid */}
              <div className="absolute inset-0 pointer-events-none opacity-25">
                <svg className="w-full h-full stroke-white fill-none" viewBox="0 0 300 450" preserveAspectRatio="none">
                  <line x1="0" y1="50" x2="300" y2="200" strokeWidth="1" />
                  <line x1="300" y1="50" x2="0" y2="250" strokeWidth="1" />
                  <line x1="50" y1="0" x2="250" y2="450" strokeWidth="1" />
                  <line x1="0" y1="350" x2="300" y2="150" strokeWidth="1" />
                </svg>
              </div>

              {/* 3D Glossy Amber Sphere Balls (Matching the Illustration in the Image) */}
              <div className="absolute -left-10 top-16 w-52 h-52 pointer-events-none">
                {/* Primary Sphere */}
                <div 
                  className="w-48 h-48 rounded-full shadow-2xl relative"
                  style={{
                    background: 'radial-gradient(circle at 35% 30%, #ffedd5 0%, #fb923c 45%, #c2410c 85%, #7c2d12 100%)',
                    boxShadow: 'inset -10px -10px 25px rgba(0,0,0,0.4), 0 20px 30px rgba(0,0,0,0.3)',
                  }}
                >
                  {/* Glossy Reflection Highlight */}
                  <div className="absolute top-6 left-10 w-8 h-4 rounded-full bg-white/70 rotate-[-25deg] blur-[1px]"></div>
                  <div className="absolute top-11 left-16 w-3 h-2 rounded-full bg-white/50 rotate-[-25deg]"></div>
                </div>
              </div>

              {/* Secondary Smaller Sphere in Background */}
              <div className="absolute right-[-15px] top-24 w-32 h-32 pointer-events-none">
                <div 
                  className="w-28 h-28 rounded-full shadow-xl relative"
                  style={{
                    background: 'radial-gradient(circle at 35% 30%, #ffedd5 0%, #fb923c 45%, #c2410c 85%, #7c2d12 100%)',
                    boxShadow: 'inset -6px -6px 18px rgba(0,0,0,0.4), 0 15px 25px rgba(0,0,0,0.25)',
                  }}
                >
                  <div className="absolute top-4 left-6 w-5 h-2.5 rounded-full bg-white/70 rotate-[-25deg] blur-[0.5px]"></div>
                </div>
              </div>

              {/* Top Banner Header */}
              <div className="relative z-10 space-y-1">
                <h2 className="text-2xl sm:text-3xl font-black tracking-wider uppercase text-white drop-shadow-sm">
                  {activeTab === 'signin' ? 'SIGN IN' : 'SIGN UP'}
                </h2>
                <div className="flex items-center space-x-2 pt-1">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-orange-100 font-mono">
                    ECFMS v2.0 PORTAL
                  </span>
                </div>
              </div>

              {/* Bottom Information Block */}
              <div className="relative z-10 mt-auto pt-24 sm:pt-32 space-y-2">
                <div className="space-y-0.5">
                  <div className="font-black text-sm sm:text-base text-white tracking-tight">
                    E-RiKON Financial Company PLC
                  </div>
                  <p className="text-[11px] text-orange-100/90 leading-relaxed font-normal">
                    Core banking workstation for double-entry financial accounting, 31-day daily collection cycles & microfinance operations.
                  </p>
                </div>

                {/* Role Switcher Chips */}
                <div className="pt-2">
                  <div className="text-[10px] font-bold text-orange-200 uppercase tracking-wider mb-1.5">
                    Select Scope:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rolesList.map((r) => {
                      const isSelected = selectedRole === r.role && activeTab === 'signin';
                      return (
                        <button
                          key={r.role}
                          type="button"
                          onClick={() => { setSelectedRole(r.role); setActiveTab('signin'); setErrorMsg(''); }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-white text-[#ea580c] font-black shadow-sm'
                              : 'bg-black/20 text-white/90 hover:bg-black/30'
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

            {/* ================= RIGHT SIDE: Pill Input Template Form ================= */}
            <div className="md:w-7/12 bg-white p-6 sm:p-8 flex flex-col justify-between relative">
              
              {/* Top Tab Bar (Matching Template: Underlined Active Tab) */}
              <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2 mb-4">
                <div className="flex items-center space-x-6">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('signup'); setErrorMsg(''); setResetSuccessMsg(null); }}
                    className={`text-sm sm:text-base font-black transition-all cursor-pointer relative pb-2 ${
                      activeTab === 'signup'
                        ? 'text-[#ea580c]'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <span>sign up</span>
                    {activeTab === 'signup' && (
                      <div className="absolute bottom-[-2px] left-0 right-0 h-[3px] bg-[#ea580c] rounded-full"></div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('signin'); setErrorMsg(''); setSignupSuccessMsg(null); }}
                    className={`text-sm sm:text-base font-black transition-all cursor-pointer relative pb-2 ${
                      activeTab === 'signin'
                        ? 'text-[#ea580c]'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <span>login</span>
                    {activeTab === 'signin' && (
                      <div className="absolute bottom-[-2px] left-0 right-0 h-[3px] bg-[#ea580c] rounded-full"></div>
                    )}
                  </button>
                </div>

                <div className="flex items-center space-x-1.5">
                  <img src={logoImg} alt="E-RiKON Logo" className="h-6 w-auto object-contain rounded-md" />
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#ea580c] border border-orange-200 uppercase">
                    {selectedRole.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Error Alert Notification */}
              {errorMsg && (
                <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center justify-between gap-2 shadow-xs animate-pulse">
                  <span className="flex-1 font-medium">{errorMsg}</span>
                  <button
                    type="button"
                    onClick={() => setErrorMsg('')}
                    className="text-rose-500 hover:text-rose-800 font-mono text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Success Notification */}
              {signupSuccessMsg && (
                <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium space-y-1.5">
                  <div className="flex items-start space-x-1.5 font-bold text-xs text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{signupSuccessMsg}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('signin')}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Proceed to Login</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {activeTab === 'signin' ? (
                /* ================= SIGN IN FORM ================= */
                <form onSubmit={handleLoginSubmit} className="space-y-3.5 my-auto">
                  
                  {/* Scope Pill Input */}
                  <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-4 py-2 flex items-center gap-2 transition-colors bg-white shadow-xs">
                    <span className="font-bold text-slate-600 text-xs shrink-0 flex items-center gap-1">
                      role <span className="text-[#ea580c]">▸</span>
                    </span>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as RoleName)}
                      className="w-full bg-transparent text-slate-900 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      {rolesList.map((r) => (
                        <option key={r.role} value={r.role}>{r.label} ({r.role})</option>
                      ))}
                    </select>
                  </div>

                  {/* Email / Login Pill Input */}
                  <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-4 py-2 flex items-center gap-2 transition-colors bg-white shadow-xs">
                    <span className="font-bold text-slate-600 text-xs shrink-0 flex items-center gap-1">
                      login <span className="text-[#ea580c]">▸</span>
                    </span>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@erikon-group.com"
                      className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-xs font-medium focus:outline-none"
                    />
                  </div>

                  {/* Password Pill Input */}
                  <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-4 py-2 flex items-center gap-2 transition-colors bg-white shadow-xs">
                    <span className="font-bold text-slate-600 text-xs shrink-0 flex items-center gap-1">
                      password <span className="text-[#ea580c]">▸</span>
                    </span>
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-xs font-medium focus:outline-none pr-2"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-500" />}
                    </button>
                  </div>

                  {/* Bottom Action Bar (Matching Template Checkmark + Pill Button) */}
                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                      <div className="w-5 h-5 rounded-full border-2 border-emerald-500 text-emerald-600 flex items-center justify-center font-black text-xs shrink-0">
                        ✓
                      </div>
                      <span>Encrypted Workstation Session Active</span>
                    </div>

                    {/* Template Pill Action Button */}
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-md shadow-orange-500/25 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] shrink-0"
                    >
                      <span>login</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                </form>
              ) : (
                /* ================= SIGN UP FORM ================= */
                <form onSubmit={handleSignupSubmit} className="space-y-2.5 my-auto">
                  
                  {/* Name Pill Input (2 Cols in 1 row) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-3.5 py-1.5 flex items-center gap-2 transition-colors bg-white shadow-xs">
                      <span className="font-bold text-slate-600 text-[11px] shrink-0 flex items-center gap-1">
                        first name <span className="text-[#ea580c]">▸</span>
                      </span>
                      <input
                        required
                        type="text"
                        value={signupFirstName}
                        onChange={(e) => setSignupFirstName(e.target.value)}
                        placeholder="Kwame"
                        className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-xs font-medium focus:outline-none"
                      />
                    </div>

                    <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-3.5 py-1.5 flex items-center gap-2 transition-colors bg-white shadow-xs">
                      <span className="font-bold text-slate-600 text-[11px] shrink-0 flex items-center gap-1">
                        last name <span className="text-[#ea580c]">▸</span>
                      </span>
                      <input
                        required
                        type="text"
                        value={signupLastName}
                        onChange={(e) => setSignupLastName(e.target.value)}
                        placeholder="Mensah"
                        className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-xs font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Email & Phone Pill Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-3.5 py-1.5 flex items-center gap-2 transition-colors bg-white shadow-xs">
                      <span className="font-bold text-slate-600 text-[11px] shrink-0 flex items-center gap-1">
                        e-mail <span className="text-[#ea580c]">▸</span>
                      </span>
                      <input
                        required
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="name@erikon.com"
                        className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-xs font-medium focus:outline-none font-mono"
                      />
                    </div>

                    <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-3.5 py-1.5 flex items-center gap-2 transition-colors bg-white shadow-xs">
                      <span className="font-bold text-slate-600 text-[11px] shrink-0 flex items-center gap-1">
                        phone <span className="text-[#ea580c]">▸</span>
                      </span>
                      <div className="w-full">
                        <GhanaPhoneInput
                          required
                          dark={false}
                          value={signupPhone}
                          onChange={(phone) => setSignupPhone(phone)}
                          placeholder="0241234567"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ghana Card & Role Pill Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-3.5 py-1.5 flex items-center gap-2 transition-colors bg-white shadow-xs">
                      <span className="font-bold text-slate-600 text-[11px] shrink-0 flex items-center gap-1">
                        card <span className="text-[#ea580c]">▸</span>
                      </span>
                      <div className="w-full">
                        <GhanaCardInput
                          required
                          dark={false}
                          value={signupGhanaCard}
                          onChange={(formatted) => setSignupGhanaCard(formatted)}
                          placeholder="123456789-0"
                        />
                      </div>
                    </div>

                    <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-3.5 py-1.5 flex items-center gap-2 transition-colors bg-white shadow-xs">
                      <span className="font-bold text-slate-600 text-[11px] shrink-0 flex items-center gap-1">
                        role <span className="text-[#ea580c]">▸</span>
                      </span>
                      <select
                        value={signupRoleType}
                        onChange={(e) => setSignupRoleType(e.target.value as RoleName)}
                        className="w-full bg-transparent text-slate-900 text-xs font-semibold focus:outline-none cursor-pointer"
                      >
                        {rolesList.map((r) => (
                          <option key={r.role} value={r.role}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Password Pill Input */}
                  <div className="rounded-full border-2 border-slate-300 hover:border-slate-400 focus-within:border-[#ea580c] px-3.5 py-1.5 flex items-center gap-2 transition-colors bg-white shadow-xs">
                    <span className="font-bold text-slate-600 text-[11px] shrink-0 flex items-center gap-1">
                      password <span className="text-[#ea580c]">▸</span>
                    </span>
                    <input
                      required
                      type={showSignupPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="confirm password"
                      className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-xs font-medium focus:outline-none pr-2 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-500" />}
                    </button>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                      <div className="w-4 h-4 rounded-full border-2 border-emerald-500 text-emerald-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                        ✓
                      </div>
                      <span>I accept the executive compliance and security terms</span>
                    </div>

                    <button
                      type="submit"
                      className="px-6 py-2 rounded-full bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-md shadow-orange-500/25 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] shrink-0"
                    >
                      <span>sign up</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                </form>
              )}

              {/* Bottom Card Footer */}
              <div className="pt-2 text-center text-[10px] text-slate-400 font-mono border-t border-slate-100 mt-2">
                E-RiKON Financial Company PLC • 256-bit Encrypted Workstation
              </div>

            </div>

          </div>
        </div>

        {/* Bottom Clean Footer */}
        <footer className="w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 pt-1 text-center sm:text-left text-[11px] text-white/80">
          <p>
            © {new Date().getFullYear()} E-RiKON Financial Company PLC. All rights reserved.
          </p>

          <button
            onClick={handleResetData}
            className="text-[10px] font-bold text-white/90 hover:text-white flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/20 hover:bg-black/30 border border-white/20 transition-all cursor-pointer"
            title="Wipe all users, registered customers, accounts, and monies to start completely from scratch"
          >
            <Trash2 className="w-3 h-3" />
            <span>Reset Records</span>
          </button>
        </footer>

      </div>
    </>
  );
};
