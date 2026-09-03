import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { resetToCleanLiveState, getRegisteredUsers } from '../services/api';
import { pullCloudToLocal } from '../services/cloudSync';
import { RoleName, getRoleHomePath } from '../types';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { GhanaCardInput, formatGhanaCardNumber, isValidGhanaCard } from '../components/ui/GhanaCardInput';
import { GhanaPhoneInput, isValidGhanaPhone } from '../components/ui/GhanaPhoneInput';
import logoImg from '../assets/logo.png';
import {
  BuildingOffice2Icon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
  DevicePhoneMobileIcon,
  CalculatorIcon,
  DocumentCheckIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

export const LoginPage: React.FC = () => {
  const { currentUser, isAuthenticated, login, signupRole } = useAuth();
  const navigate = useNavigate();

  // If user is already signed into a role, prevent accessing login page unless Switch Role was clicked
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      navigate(getRoleHomePath(currentUser.role), { replace: true });
    }
  }, [isAuthenticated, currentUser, navigate]);

  // Tab State: 'signin' | 'signup'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  // Sign In State (Clean Empty Inputs for Real Production Data)
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
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupSuccessMsg, setSignupSuccessMsg] = useState<string | null>(null);

  // Sync latest cloud data once on mount
  useEffect(() => {
    pullCloudToLocal().catch(() => {});
  }, []);

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

  const rolesList: { role: RoleName; label: string }[] = [
    { role: 'SUPER_ADMIN', label: 'Super Admin' },
    { role: 'ADMIN', label: 'Operations Admin' },
    { role: 'TELLER', label: 'Teller Station' },
    { role: 'FIELD_OFFICER', label: 'Field Officer' },
    { role: 'LOAN_OFFICER', label: 'Loan Officer' },
    { role: 'AUDITOR', label: 'Auditor Desk' },
  ];

  const handleRoleSelect = (role: RoleName) => {
    setSelectedRole(role);
    setErrorMsg('');
  };

  const handleRoleDropdownChange = (role: RoleName) => {
    setSelectedRole(role);
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

      navigate(getRoleHomePath(targetRole), { replace: true });
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

    const finalGhanaCard = formatGhanaCardNumber(signupGhanaCard);
    if (!isValidGhanaCard(finalGhanaCard)) {
      setErrorMsg('Please enter a valid Ghana Card PIN in the format GHA-XXXXXXXXX-X (e.g. GHA-000568509-7).');
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
        ghanaCard: finalGhanaCard,
        employeeId: signupEmployeeId,
        password: signupPassword,
      });

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

      {/* Main Screen Canvas matching Figma Mockup */}
      <div className="min-h-screen lg:h-screen lg:max-h-screen w-full bg-[#f1f5f9] flex flex-col justify-between p-3 sm:p-5 lg:p-6 select-none overflow-y-auto lg:overflow-hidden font-sans">
        
        {/* Global Reset Notification */}
        {resetSuccessMsg && (
          <div className="relative z-30 max-w-xl w-full mx-auto mb-2 p-2.5 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs text-center shadow-lg animate-bounce">
            {resetSuccessMsg}
          </div>
        )}

        {/* Central Master Card matching Figma Image Exactly */}
        <div className="flex-1 flex items-center justify-center my-auto w-full max-w-[1020px] mx-auto">
          <div className="w-full bg-white rounded-[32px] sm:rounded-[36px] shadow-2xl shadow-slate-900/10 overflow-hidden flex flex-col md:flex-row min-h-[490px] border border-slate-100">
            
            {/* ================= LEFT SIDE: Geometric Faceted Polygon Mesh ================= */}
            <div className="md:w-5/12 bg-[#061d31] text-white p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shrink-0">
              
              {/* SVG Faceted Polygonal Geometric Mesh based on Logo Palette */}
              <div className="absolute inset-0 pointer-events-none opacity-85">
                <svg className="w-full h-full object-cover" viewBox="0 0 400 600" preserveAspectRatio="none" fill="none">
                  {/* Facet Polygons with rich logo greens, teals, cyans, and blues */}
                  <polygon points="0,0 200,0 120,100" fill="#0b3856" />
                  <polygon points="200,0 400,0 320,80" fill="#14532d" />
                  <polygon points="120,100 200,0 280,110" fill="#047857" />
                  <polygon points="0,0 120,100 0,160" fill="#0f766e" />
                  <polygon points="0,160 120,100 80,240" fill="#0d9488" />
                  <polygon points="120,100 280,110 200,220" fill="#10b981" />
                  <polygon points="280,110 400,0 400,140" fill="#15803d" />
                  <polygon points="280,110 400,140 340,240" fill="#84cc16" />
                  <polygon points="200,220 280,110 340,240" fill="#4ade80" />
                  <polygon points="80,240 120,100 200,220" fill="#06b6d4" />
                  <polygon points="0,160 80,240 0,320" fill="#0369a1" />
                  <polygon points="80,240 200,220 140,360" fill="#0891b2" />
                  <polygon points="200,220 340,240 260,370" fill="#22c55e" />
                  <polygon points="340,240 400,140 400,300" fill="#65a30d" />
                  <polygon points="340,240 400,300 370,410" fill="#4d7c0f" />
                  <polygon points="260,370 340,240 370,410" fill="#16a34a" />
                  <polygon points="140,360 200,220 260,370" fill="#0284c7" />
                  <polygon points="0,320 80,240 140,360" fill="#0c4a6e" />
                  <polygon points="0,320 140,360 60,460" fill="#075985" />
                  <polygon points="60,460 140,360 210,480" fill="#0891b2" />
                  <polygon points="140,360 260,370 210,480" fill="#0f766e" />
                  <polygon points="210,480 260,370 320,490" fill="#15803d" />
                  <polygon points="260,370 370,410 320,490" fill="#16a34a" />
                  <polygon points="370,410 400,300 400,480" fill="#3f6212" />
                  <polygon points="370,410 400,480 400,600" fill="#14532d" />
                  <polygon points="320,490 370,410 400,600" fill="#15803d" />
                  <polygon points="210,480 320,490 280,600" fill="#065f46" />
                  <polygon points="60,460 210,480 160,600" fill="#042f2e" />
                  <polygon points="0,320 60,460 0,550" fill="#082f49" />
                  <polygon points="0,550 60,460 160,600" fill="#0a2540" />
                  <polygon points="0,550 160,600 0,600" fill="#041829" />
                  <polygon points="160,600 210,480 280,600" fill="#064e3b" />
                  <polygon points="280,600 320,490 400,600" fill="#14532d" />
                </svg>
              </div>

              {/* Gradient Dark Overlay to match Figma background depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#051b2c] via-[#051b2c]/85 to-transparent pointer-events-none"></div>

              {/* Top Banner Header */}
              <div className="relative z-10 space-y-1">
                <h2 className="text-2xl sm:text-3xl font-black tracking-wider uppercase text-white drop-shadow-xs">
                  {activeTab === 'signin' ? 'SIGN IN' : 'SIGN UP'}
                </h2>
                <div className="flex items-center space-x-2 pt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-slate-200 font-mono">
                    ECFMS V2.0 PORTAL
                  </span>
                </div>
              </div>

              {/* Middle & Bottom Information Block */}
              <div className="relative z-10 mt-auto pt-16 sm:pt-24 space-y-3">
                <div className="space-y-1">
                  <div className="font-black text-sm sm:text-base text-white tracking-tight">
                    E-RiKON Financial Company PLC
                  </div>
                  <p className="text-[11px] text-slate-300/90 leading-relaxed font-normal">
                    Core banking workstation for double-entry financial accounting, 31-day daily collection cycles & microfinance operations.
                  </p>
                </div>

                {/* SELECT SCOPE Buttons matching Figma exact pill colors */}
                <div className="pt-2">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-wider mb-2">
                    SELECT SCOPE:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rolesList.map((r) => {
                      const isSelected = selectedRole === r.role && activeTab === 'signin';
                      return (
                        <button
                          key={r.role}
                          type="button"
                          onClick={() => handleRoleSelect(r.role)}
                          className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-white text-slate-900 font-black shadow-md'
                              : 'bg-[#155e75]/80 text-white hover:bg-[#0e7490] border border-cyan-500/20'
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

            {/* ================= RIGHT SIDE: Interactive Form matching Figma UI ================= */}
            <div className="md:w-7/12 bg-white p-6 sm:p-8 flex flex-col justify-between relative">
              
              {/* Top Navigation Bar with Underlined Tab & Official Brand Logo */}
              <div className="flex items-center justify-between pb-3 mb-3">
                <div className="flex items-center space-x-6">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('signup'); setErrorMsg(''); setResetSuccessMsg(null); }}
                    className={`text-sm sm:text-base font-bold transition-all cursor-pointer relative pb-1 ${
                      activeTab === 'signup'
                        ? 'text-[#065f46] font-black'
                        : 'text-slate-700 hover:text-slate-950 font-bold'
                    }`}
                  >
                    <span>sign up</span>
                    {activeTab === 'signup' && (
                      <div className="absolute bottom-[-4px] left-0 right-0 h-[2.5px] bg-[#065f46] rounded-full"></div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('signin'); setErrorMsg(''); setSignupSuccessMsg(null); }}
                    className={`text-sm sm:text-base font-bold transition-all cursor-pointer relative pb-1 ${
                      activeTab === 'signin'
                        ? 'text-[#065f46] font-black'
                        : 'text-slate-700 hover:text-slate-950 font-bold'
                    }`}
                  >
                    <span>login</span>
                    {activeTab === 'signin' && (
                      <div className="absolute bottom-[-4px] left-0 right-0 h-[2.5px] bg-[#065f46] rounded-full"></div>
                    )}
                  </button>
                </div>

                {/* Logo & Active Role Badge matching Figma exactly */}
                <div className="flex items-center space-x-2">
                  <img src={logoImg} alt="E-RIKON GROUP Financial Services" className="h-7 w-auto object-contain" />
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#0a3866] text-white uppercase tracking-wider">
                    {selectedRole.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Error Alert Notification */}
              {errorMsg && (
                <div className="mb-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center justify-between gap-2 shadow-xs animate-pulse">
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
                <div className="mb-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium space-y-1.5">
                  <div className="flex items-start space-x-1.5 font-bold text-xs text-emerald-700">
                    <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{signupSuccessMsg}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('signin')}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Proceed to Login</span>
                    <ChevronRightIcon className="w-3 h-3" />
                  </button>
                </div>
              )}

              {activeTab === 'signin' ? (
                /* ================= SIGN IN FORM ================= */
                <form onSubmit={handleLoginSubmit} className="auth-form space-y-3.5 my-auto">
                  
                  {/* Role Selector Input matching Figma */}
                  <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-4 py-2.5 flex items-center justify-between gap-2 transition-colors bg-white shadow-2xs">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="font-semibold text-slate-700 text-xs shrink-0 flex items-center gap-1">
                        role <span className="text-[#ea580c] text-[10px]">▸</span>
                      </span>
                      <select
                        value={selectedRole}
                        onChange={(e) => handleRoleDropdownChange(e.target.value as RoleName)}
                        style={{ color: '#0f172a' }}
                        className="w-full bg-transparent text-slate-900 !text-slate-900 text-xs font-semibold focus:outline-none cursor-pointer appearance-none truncate"
                      >
                        {rolesList.map((r) => (
                          <option key={r.role} value={r.role} className="text-slate-900 bg-white">{r.label} ({r.role})</option>
                        ))}
                      </select>
                    </div>
                    <ChevronDownIcon className="w-4 h-4 text-slate-500 shrink-0 pointer-events-none" />
                  </div>

                  {/* Email / Login Input matching Figma */}
                  <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-4 py-2.5 flex items-center gap-2 transition-colors bg-white shadow-2xs">
                    <span className="font-semibold text-slate-700 text-xs shrink-0 flex items-center gap-1">
                      login <span className="text-[#ea580c] text-[10px]">▸</span>
                    </span>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@erikon.com"
                      style={{ color: '#0f172a' }}
                      className="w-full bg-transparent text-slate-900 !text-slate-900 placeholder:!text-slate-500 placeholder-slate-500 text-xs font-medium focus:outline-none"
                    />
                  </div>

                  {/* Password Input matching Figma with Eye icon */}
                  <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-4 py-2.5 flex items-center gap-2 transition-colors bg-white shadow-2xs">
                    <span className="font-semibold text-slate-700 text-xs shrink-0 flex items-center gap-1">
                      password <span className="text-[#ea580c] text-[10px]">▸</span>
                    </span>
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ color: '#0f172a' }}
                      className="w-full bg-transparent text-slate-900 !text-slate-900 placeholder:!text-slate-500 placeholder-slate-500 text-xs font-medium focus:outline-none pr-1 tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4 text-slate-500" />}
                    </button>
                  </div>

                  {/* Bottom Action Row: Checkmark & Forest Green Pill Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center space-x-2 text-xs text-slate-600 font-medium">
                      <div className="w-5 h-5 rounded-full border-2 border-emerald-600 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                        ✓
                      </div>
                      <span>Encrypted Workstation Session Active</span>
                    </div>

                    {/* Dark Forest Green Pill Button matching Figma */}
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-full bg-[#166534] hover:bg-[#14532d] text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-md shadow-emerald-900/20 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] shrink-0"
                    >
                      <span>login</span>
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </form>
              ) : (
                /* ================= SIGN UP FORM ================= */
                <form onSubmit={handleSignupSubmit} className="auth-form space-y-2.5 my-auto">
                  
                  {/* Name Pill Input (2 Cols in 1 row) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-3.5 py-1.5 flex items-center gap-1.5 transition-colors bg-white shadow-2xs">
                      <span className="font-semibold text-slate-700 text-[11px] shrink-0 flex items-center gap-1">
                        first name <span className="text-[#ea580c] text-[9px]">▸</span>
                      </span>
                      <input
                        required
                        type="text"
                        value={signupFirstName}
                        onChange={(e) => setSignupFirstName(e.target.value)}
                        placeholder="Kwame"
                        style={{ color: '#0f172a' }}
                        className="w-full bg-transparent text-slate-900 !text-slate-900 placeholder:!text-slate-500 placeholder-slate-500 text-xs font-medium focus:outline-none"
                      />
                    </div>

                    <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-3.5 py-1.5 flex items-center gap-1.5 transition-colors bg-white shadow-2xs">
                      <span className="font-semibold text-slate-700 text-[11px] shrink-0 flex items-center gap-1">
                        last name <span className="text-[#ea580c] text-[9px]">▸</span>
                      </span>
                      <input
                        required
                        type="text"
                        value={signupLastName}
                        onChange={(e) => setSignupLastName(e.target.value)}
                        placeholder="Mensah"
                        style={{ color: '#0f172a' }}
                        className="w-full bg-transparent text-slate-900 !text-slate-900 placeholder:!text-slate-500 placeholder-slate-500 text-xs font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Email & Phone Pill Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-3.5 py-1.5 flex items-center gap-1.5 transition-colors bg-white shadow-2xs">
                      <span className="font-semibold text-slate-700 text-[11px] shrink-0 flex items-center gap-1">
                        login <span className="text-[#ea580c] text-[9px]">▸</span>
                      </span>
                      <input
                        required
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="name@erikon.com"
                        style={{ color: '#0f172a' }}
                        className="w-full bg-transparent text-slate-900 !text-slate-900 placeholder:!text-slate-500 placeholder-slate-500 text-xs font-medium focus:outline-none font-mono"
                      />
                    </div>

                    <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-3.5 py-1.5 flex items-center gap-1.5 transition-colors bg-white shadow-2xs">
                      <span className="font-semibold text-slate-700 text-[11px] shrink-0 flex items-center gap-1">
                        phone <span className="text-[#ea580c] text-[9px]">▸</span>
                      </span>
                      <div className="w-full auth-light-input">
                        <GhanaPhoneInput
                          required
                          variant="pill"
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
                    <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-3.5 py-1.5 flex items-center gap-1.5 transition-colors bg-white shadow-2xs">
                      <span className="font-semibold text-slate-700 text-[11px] shrink-0 flex items-center gap-1">
                        card <span className="text-[#ea580c] text-[9px]">▸</span>
                      </span>
                      <div className="w-full auth-light-input">
                        <GhanaCardInput
                          required
                          variant="pill"
                          dark={false}
                          value={signupGhanaCard}
                          onChange={(formatted) => setSignupGhanaCard(formatted)}
                          placeholder="GHA-000000000-0"
                        />
                      </div>
                    </div>

                    <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-3.5 py-1.5 flex items-center justify-between gap-1.5 transition-colors bg-white shadow-2xs">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span className="font-semibold text-slate-700 text-[11px] shrink-0 flex items-center gap-1">
                          role <span className="text-[#ea580c] text-[9px]">▸</span>
                        </span>
                        <select
                          value={signupRoleType}
                          onChange={(e) => setSignupRoleType(e.target.value as RoleName)}
                          style={{ color: '#0f172a', backgroundColor: 'transparent' }}
                          className="w-full bg-transparent text-slate-900 !text-slate-900 text-xs font-semibold focus:outline-none cursor-pointer appearance-none truncate"
                        >
                          {rolesList.map((r) => (
                            <option
                              key={r.role}
                              value={r.role}
                              style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                              className="text-slate-900 bg-white"
                            >
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <ChevronDownIcon className="w-3.5 h-3.5 text-slate-500 shrink-0 pointer-events-none" />
                    </div>
                  </div>

                  {/* Password Pill Input */}
                  <div className="auth-pill-input rounded-full border border-slate-300 hover:border-slate-400 focus-within:border-[#065f46] px-3.5 py-1.5 flex items-center gap-1.5 transition-colors bg-white shadow-2xs">
                    <span className="font-semibold text-slate-700 text-[11px] shrink-0 flex items-center gap-1">
                      password <span className="text-[#ea580c] text-[9px]">▸</span>
                    </span>
                    <input
                      required
                      type={showSignupPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="confirm password"
                      style={{ color: '#0f172a' }}
                      className="w-full bg-transparent text-slate-900 !text-slate-900 placeholder:!text-slate-500 placeholder-slate-500 text-xs font-medium focus:outline-none pr-2 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showSignupPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4 text-slate-500" />}
                    </button>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-medium">
                      <div className="w-4 h-4 rounded-full border-2 border-emerald-600 text-emerald-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                        ✓
                      </div>
                      <span>I accept executive compliance terms</span>
                    </div>

                    <button
                      type="submit"
                      className="px-6 py-2 rounded-full bg-[#166534] hover:bg-[#14532d] text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-md shadow-emerald-900/20 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] shrink-0"
                    >
                      <span>sign up</span>
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </form>
              )}

              {/* Bottom Card Footer Monospace matching Figma */}
              <div className="pt-3 text-center text-[11px] text-slate-400 font-mono border-t border-slate-100 mt-2">
                E-RiKON Financial Company PLC • 256-bit Encrypted Workstation
              </div>

            </div>

          </div>
        </div>

        {/* Bottom Clean Footer */}
        <footer className="w-full max-w-[1020px] mx-auto flex flex-col sm:flex-row items-center justify-between shrink-0 pt-2 pb-4 text-center text-xs text-slate-500 font-medium gap-2">
          <p>
            © {new Date().getFullYear()} E-RiKON Financial Company PLC. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                resetToCleanLiveState();
                pullCloudToLocal().then(() => {
                  window.location.reload();
                });
              }}
              className="text-[11px] text-slate-400 hover:text-amber-600 transition-colors flex items-center gap-1 cursor-pointer font-mono"
              title="Purge cached device records and fetch pristine cloud state"
            >
              <span>🔄 Hard Refresh & Sync</span>
            </button>
          </div>
        </footer>

      </div>
    </>
  );
};
