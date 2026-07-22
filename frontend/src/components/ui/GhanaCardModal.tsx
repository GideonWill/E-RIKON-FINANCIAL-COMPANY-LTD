import React from 'react';
import { Customer } from '../../types';
import { ShieldCheck, X, CreditCard, User, CheckCircle } from 'lucide-react';

interface GhanaCardModalProps {
  customer: Customer | null;
  onClose: () => void;
}

export const GhanaCardModal: React.FC<GhanaCardModalProps> = ({ customer, onClose }) => {
  if (!customer) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
        
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
                National Identity Authority (NIA) Ghana Card Inspection
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

        {/* Ghana Card Digital Display Frame */}
        <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 p-6 rounded-2xl border border-amber-500/30 text-white space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <CreditCard className="w-48 h-48 text-amber-500" />
          </div>

          <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center font-bold text-xs text-slate-900">
                GH
              </div>
              <span className="font-extrabold text-sm tracking-wide text-amber-400">
                REPUBLIC OF GHANA • NATIONAL IDENTITY CARD
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
              {customer.ghanaCardNumber}
            </span>
          </div>

          {/* Card Body */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            {/* Passport Photo */}
            <div className="flex flex-col items-center space-y-2">
              <img
                src={customer.passportPhotoUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'}
                alt="Passport"
                className="w-28 h-32 object-cover rounded-xl border-2 border-amber-500/50 shadow-md"
              />
              <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-400" /> Photo Verified
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
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Mobile Number</div>
                  <div className="font-bold text-amber-400">{customer.phone}</div>
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
            <span>Identity matched against E-RIKON Central Vault</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold hover:bg-slate-800 transition-all"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
