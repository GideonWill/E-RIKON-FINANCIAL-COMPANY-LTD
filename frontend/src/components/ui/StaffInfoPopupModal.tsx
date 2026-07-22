import React from 'react';
import { User, RoleName } from '../../types';
import { MOCK_USERS } from '../../services/api';
import { 
  UserCheck, 
  ShieldCheck, 
  Building2, 
  Mail, 
  Phone, 
  CreditCard, 
  X, 
  CheckCircle2, 
  Clock, 
  KeyRound,
  ShieldAlert,
  Landmark,
  Smartphone,
  Calculator
} from 'lucide-react';

interface StaffInfoPopupModalProps {
  staffName: string | null;
  onClose: () => void;
}

export const StaffInfoPopupModal: React.FC<StaffInfoPopupModalProps> = ({ staffName, onClose }) => {
  if (!staffName) return null;

  // Lookup matched mock staff member by name substring or default to Field Officer/Teller
  const allStaff = Object.values(MOCK_USERS);
  const matchedStaff = allStaff.find(
    (s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(staffName.toLowerCase()) ||
      staffName.toLowerCase().includes(s.firstName.toLowerCase())
  ) || MOCK_USERS.FIELD_OFFICER;

  const getRoleIcon = (role: RoleName) => {
    switch (role) {
      case 'TELLER':
        return <Landmark className="w-5 h-5 text-amber-400" />;
      case 'FIELD_OFFICER':
        return <Smartphone className="w-5 h-5 text-blue-400" />;
      case 'LOAN_OFFICER':
        return <Calculator className="w-5 h-5 text-purple-400" />;
      case 'SUPER_ADMIN':
        return <ShieldCheck className="w-5 h-5 text-rose-400" />;
      case 'BRANCH_ADMIN':
        return <Building2 className="w-5 h-5 text-emerald-400" />;
      default:
        return <ShieldAlert className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Staff Identity Card
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  STAFF VERIFIED
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                E-RIKON Core Banking Personnel Dossier
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Staff Profile Highlight Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white text-2xl font-extrabold ring-4 ring-amber-500/30 shadow-lg">
              {matchedStaff.firstName[0]}{matchedStaff.lastName[0]}
            </div>

            <div>
              <div className="text-[11px] font-mono text-amber-400 font-extrabold flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" /> Employee ID: {matchedStaff.employeeId}
              </div>
              <h4 className="text-xl font-extrabold tracking-tight text-white mt-0.5">
                {matchedStaff.firstName} {matchedStaff.lastName}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-slate-950">
                  {matchedStaff.role.replace('_', ' ')}
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                  {getRoleIcon(matchedStaff.role)}
                  {matchedStaff.branch?.name || 'Accra Main'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
              <Mail className="w-3 h-3 text-amber-500" /> Email Address
            </span>
            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {matchedStaff.email}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
              <Phone className="w-3 h-3 text-blue-500" /> Mobile Line
            </span>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              {matchedStaff.phone}
            </div>
          </div>
        </div>

        {/* Workstation Activity Summary */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2 text-white font-sans">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-amber-400 tracking-wider">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Staff Workstation Status & Operations
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Staff member <strong>{matchedStaff.firstName} {matchedStaff.lastName}</strong> is currently assigned to <strong>{matchedStaff.branch?.name}</strong> operating as <strong>{matchedStaff.role.replace('_', ' ')}</strong> with verified system clearance.
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
        >
          Close Personnel Dossier
        </button>

      </div>
    </div>
  );
};
