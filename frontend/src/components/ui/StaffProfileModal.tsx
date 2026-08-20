import React, { useState } from 'react';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { deleteRegisteredUser } from '../../services/api';
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
  Shield,
  Trash2,
  AlertTriangle,
  LogOut
} from 'lucide-react';

interface StaffProfileModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
}

export const StaffProfileModal: React.FC<StaffProfileModalProps> = ({ isOpen, user, onClose }) => {
  const { logout } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  if (!isOpen || !user) return null;

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const rolePrivileges: Record<string, string[]> = {
    SUPER_ADMIN: [
      'Full System Administration & Branch Management',
      'Global Audit Log & Financial Ledger Inspection',
      'Branch Cash Limits & Vault Threshold Configuration',
      'System Settings & Master Override Privileges',
    ],
    BRANCH_ADMIN: [
      'Local Branch Staff Management & Operations',
      'Credit Evaluation & Local Loan Approvals',
      'Vault Balancing & Cash Summary Inspection',
      'Branch Customer Account Approvals',
    ],
    TELLER: [
      'Physical Cash Deposit & Cash Withdrawal Processing',
      'Paperless Official Receipt Issuance & Stamping',
      'Daily Teller Vault Cash Reconciliation',
      'Customer Identification & Ghana Card Lookup',
    ],
    FIELD_OFFICER: [
      'Mobile Onsite Daily Savings Collection (31-Day Policy)',
      'Onsite Customer Registration & Document Capture',
      'Field Collection Target Tracking & Field Receipts',
      'Assigned Route Customer Profile Management',
    ],
    LOAN_OFFICER: [
      'ER-Fast Loan Origination & Application Processing',
      'Tiered Tenor Interest Calculator (10%, 15%, 25%, 30%)',
      'Collateral & Guarantor Inspection',
      'Repayment Schedule & Loan Arrears Tracking',
    ],
    AUDITOR: [
      'Immutable Double-Entry Ledger Read-Only Audit',
      'Financial Reports & Cash Flow Inspection',
      'System Compliance & Security Trail Monitoring',
      'Excel & CSV Export Generation',
    ],
  };

  const privileges = rolePrivileges[user.role] || ['Standard Staff Privileges'];

  // Handle Permanent Super Admin Self-Deletion
  const handleDeleteSuperAdminAccount = async () => {
    if (!isSuperAdmin) return;
    setIsDeleting(true);
    try {
      await deleteRegisteredUser(user.id, user);
      onClose();
      logout();
      alert(`✅ Super Admin account (${user.email}) has been permanently deleted.\n\nAll company customer records, account balances, and financial history remain 100% safe and intact.\n\nYou can now register or log in with a new Super Admin account.`);
    } catch (err: any) {
      alert(err.message || 'Failed to delete Super Admin account.');
      setIsDeleting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative overflow-hidden max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Staff Identity Profile
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ACTIVE STAFF
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                E-RiKON Financial Company PLC • Employee Dossier
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Staff Profile Card Header */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white text-2xl font-extrabold ring-4 ring-amber-500/30 shadow-lg">
              {user.firstName[0]}{user.lastName[0]}
            </div>

            <div>
              <div className="text-[11px] font-mono text-amber-400 font-extrabold flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" /> ID: {user.employeeId || 'EMP-ADMIN'}
              </div>
              <h4 className="text-xl font-extrabold tracking-tight text-white mt-0.5">
                {user.firstName} {user.lastName}
              </h4>
              <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-slate-950">
                {user.role.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Mail className="w-3 h-3 text-amber-500" /> Staff Email
            </span>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
              {user.email}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Phone className="w-3 h-3 text-blue-500" /> Phone Line
            </span>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {user.phone || '—'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Building2 className="w-3 h-3 text-purple-500" /> Primary Branch
            </span>
            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {user.branch?.name || 'Accra Central Main Branch'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-500" /> Session Status
            </span>
            <div className="font-bold text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated
            </div>
          </div>
        </div>

        {/* Role Workstation Privileges Box */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2 text-white">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-amber-400 tracking-wider">
            <span className="flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> Role Privileges & Workstation Scope
            </span>
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          <ul className="space-y-1.5 pt-1 text-slate-300">
            {privileges.map((priv, idx) => (
              <li key={idx} className="flex items-start gap-2 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{priv}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ================= SUPER ADMIN DELETE ACCOUNT SECTION ================= */}
        {isSuperAdmin && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-3">
            {!showDeleteConfirm ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Super Admin Account</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Permanently delete this account. Company financial and client data will remain 100% intact.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/20 cursor-pointer w-fit shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-300 dark:border-rose-800 animate-fade-in">
                <div className="flex items-start space-x-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="block text-sm">Confirm Super Admin Account Deletion</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-normal">
                      Are you sure you want to permanently delete your Super Admin account (<strong>{user.firstName} {user.lastName}</strong> - {user.email})?
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
                  🛡️ <strong>Zero Data Disruption Guarantee:</strong> All customer profiles, transactions, daily collection cycles, loans, and financial statements remain completely untouched and safe. A new Super Admin account can be registered immediately.
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSuperAdminAccount}
                    disabled={isDeleting}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-600/30 cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs transition-all cursor-pointer shadow-md"
        >
          Close Profile
        </button>

      </div>
    </div>
  );
};
