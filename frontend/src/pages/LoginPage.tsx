import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RoleName } from '../types';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import logoImg from '../assets/logo.jpeg';
import { 
  Building2, 
  ShieldCheck, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Landmark, 
  Smartphone, 
  Calculator, 
  FileCheck, 
  Sparkles,
  KeyRound
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<RoleName>('TELLER');
  const [email, setEmail] = useState('teller@erikon-group.com');
  const [password, setPassword] = useState('erikon2026');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const rolesList: { role: RoleName; label: string; email: string; icon: any; color: string; desc: string }[] = [
    {
      role: 'TELLER',
      label: 'Teller Workstation',
      email: 'teller@erikon-group.com',
      icon: Landmark,
      color: 'from-amber-500 to-amber-600',
      desc: 'Physical Cash Deposit, Cash Withdrawal & Paperless Receipt Issuance Desk',
    },
    {
      role: 'FIELD_OFFICER',
      label: 'Field Officer Desk',
      email: 'field.officer@erikon-group.com',
      icon: Smartphone,
      color: 'from-blue-500 to-blue-600',
      desc: 'Mobile Onsite Daily Savings Collection (31-Day Policy) & Field Receipts',
    },
    {
      role: 'LOAN_OFFICER',
      label: 'Loan Officer Desk',
      email: 'loan.officer@erikon-group.com',
      icon: Calculator,
      color: 'from-purple-500 to-purple-600',
      desc: 'ER-Fast Loan Origination, Tiered Interest Quotes (10-30%) & Arrears Tracker',
    },
    {
      role: 'SUPER_ADMIN',
      label: 'Super Admin Portal',
      email: 'admin@erikon-group.com',
      icon: ShieldCheck,
      color: 'from-rose-500 to-rose-600',
      desc: 'Global System Operations, Executive KPI Dashboard & Branch Management',
    },
    {
      role: 'BRANCH_ADMIN',
      label: 'Branch Admin Portal',
      email: 'branch.admin@erikon-group.com',
      icon: Building2,
      color: 'from-emerald-500 to-emerald-600',
      desc: 'Branch Operations, Vault Cash Reconciliation & Local Credit Approval',
    },
    {
      role: 'AUDITOR',
      label: 'Auditor Portal',
      email: 'auditor@erikon-group.com',
      icon: FileCheck,
      color: 'from-indigo-500 to-indigo-600',
      desc: 'Immutable Double-Entry Financial Ledger & Compliance Trail Audit',
    },
  ];

  const handleRoleSelect = (item: typeof rolesList[0]) => {
    setSelectedRole(item.role);
    setEmail(item.email);
    setPassword('erikon2026');
    setErrorMsg('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const success = login(email, password, selectedRole);
      setIsLoading(false);

      if (success) {
        // Redirect strictly to active workstation role screen
        switch (selectedRole) {
          case 'SUPER_ADMIN':
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
        setErrorMsg('Invalid staff authentication credentials or unauthorized role assignment.');
      }
    }, 1200);
  };

  return (
    <>
      {isLoading && (
        <LoadingScreen 
          message={`Authenticating ${selectedRole.replace('_', ' ')} Workstation Clearance...`}
          subMessage="E-RIKON GROUP FINANCIAL COMPANY LTD • Securing Session"
        />
      )}

      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-sans">
        
        {/* Background Lighting Effects */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header */}
        <div className="flex items-center justify-between z-10 max-w-7xl w-full mx-auto">
          <div className="flex items-center space-x-3">
            <img 
              src={logoImg} 
              alt="E-RIKON GROUP FINANCIAL COMPANY LTD Logo" 
              className="h-12 w-auto object-contain rounded-lg"
            />
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-white flex items-center gap-2">
                E-RIKON <span className="text-amber-400 font-semibold text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">ECFMS v1.0</span>
              </h1>
              <p className="text-xs text-slate-400">
                E-RIKON GROUP FINANCIAL COMPANY LTD • Core Financial Management System
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-mono text-slate-300">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>Accra Central Main Branch</span>
          </div>
        </div>

        {/* Main Login Area */}
        <div className="max-w-6xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
          
          {/* Left Column: Role Selector Cards */}
          <div className="lg:col-span-7 space-y-4">
            
            <div className="space-y-2">
              <span className="text-amber-400 text-xs font-extrabold tracking-wider uppercase flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" /> STAFF ROLE LOGIN PORTAL
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">
                Select Your Authorized Staff Workstation
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click any staff role below to auto-fill verified credentials, inspect password, and access your workstation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {rolesList.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedRole === item.role;

                return (
                  <div
                    key={item.role}
                    onClick={() => handleRoleSelect(item)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-amber-500 shadow-xl ring-2 ring-amber-500/40 translate-y-[-2px]'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.color} text-white shadow-md`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-white">{item.label}</h4>
                        <p className="text-[10px] text-amber-400 font-mono font-semibold">{item.role}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2.5 line-clamp-2 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Right Column: Authentication Input Form */}
          <div className="lg:col-span-5">
            
            <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-6 relative overflow-hidden">
              
              {/* Top Logo Banner inside login box */}
              <div className="flex flex-col items-center text-center space-y-2 border-b border-slate-800 pb-4">
                <img 
                  src={logoImg} 
                  alt="E-RIKON Logo" 
                  className="h-16 w-auto max-w-[200px] object-contain rounded-xl shadow-md"
                />
                <h3 className="text-xl font-extrabold text-white">Staff Authentication</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Workstation: <span className="text-amber-400 font-bold">{selectedRole.replace('_', ' ')}</span>
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                
                <div>
                  <label className="font-bold text-slate-300">Staff Official Email *</label>
                  <div className="relative mt-1">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      placeholder="staff@erikon-group.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300">Workstation Password *</label>
                  <div className="relative mt-1">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-amber-400 transition-colors p-1 cursor-pointer"
                      title={showPassword ? 'Hide Password' : 'Show Password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-sm flex items-center justify-center space-x-2 transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
                  >
                    <span>Authenticate & Open Workstation</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </form>

              <div className="pt-4 border-t border-slate-800/80 text-center">
                <p className="text-[11px] text-slate-500 font-mono">
                  Protected by E-RIKON Strict RBAC Security Clearance
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="max-w-7xl w-full mx-auto text-center z-10 pt-4 border-t border-slate-900">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} E-RIKON GROUP FINANCIAL COMPANY LTD. All rights reserved. • Physical Core Banking Operations
          </p>
        </div>

      </div>
    </>
  );
};
