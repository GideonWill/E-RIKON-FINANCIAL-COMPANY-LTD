import React from 'react';
import { Customer } from '../../types';
import { ShieldCheck, X, CreditCard, User, CheckCircle, Award } from 'lucide-react';

interface GhanaCardModalProps {
  customer: Customer | null;
  onClose: () => void;
}

export const GhanaCardModal: React.FC<GhanaCardModalProps> = ({ customer, onClose }) => {
  if (!customer) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[88vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Ghana Card Verification View
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold">
                  NIA VERIFIED
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                National Identification Authority (NIA) Digital Record Inspection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ghana Card Digital Display Frame */}
        <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 p-6 rounded-2xl border border-amber-500/30 text-white space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <CreditCard className="w-48 h-48 text-amber-500" />
          </div>

          <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-black text-xs text-slate-950 shadow-sm">
                GH
              </div>
              <span className="font-extrabold text-xs sm:text-sm tracking-wide text-amber-400">
                REPUBLIC OF GHANA • NATIONAL IDENTITY AUTHORITY
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
              {customer.ghanaCardNumber}
            </span>
          </div>

          {/* Card Body */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            {/* Verified Digital Seal & Initials */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center font-mono font-black text-amber-400 text-xl">
                  {customer.firstName[0]}{customer.lastName[0]}
                </div>
              </div>
              <div className="font-mono font-bold text-xs text-slate-200">{customer.customerNumber}</div>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle className="w-3 h-3 text-emerald-400" /> NIA Verified
              </span>
            </div>

            {/* Details */}
            <div className="sm:col-span-2 space-y-3 text-xs">
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Full Name</div>
                <div className="font-extrabold text-base text-white tracking-tight">
                  {customer.firstName} {customer.otherNames || ''} {customer.lastName}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Date of Birth</div>
                  <div className="font-bold text-slate-200">{customer.dateOfBirth}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Gender</div>
                  <div className="font-bold text-slate-200">{customer.gender}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Occupation</div>
                  <div className="font-bold text-slate-200">{customer.occupation}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Phone Contact</div>
                  <div className="font-bold text-amber-400 font-mono">{customer.phone}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Residential Address</div>
                <div className="font-medium text-slate-300">{customer.address}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle className="w-4 h-4" />
            <span>Digital Ghana Card Verification Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
