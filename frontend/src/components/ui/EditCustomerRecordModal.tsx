import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Account, User, SavingsPackage } from '../../types';
import { 
  superAdminUpdateCustomerAndSavings,
  toDecimal,
  getStoredAccounts,
  getStoredCustomers,
  MOCK_BRANCHES
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { GhanaPhoneInput } from './GhanaPhoneInput';
import { 
  XMarkIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  UserIcon,
  BanknotesIcon,
  DocumentTextIcon,
  LockClosedIcon,
  IdentificationIcon
} from '@heroicons/react/24/outline';

interface EditCustomerRecordModalProps {
  customer: Customer | null;
  account?: Account | null;
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedCustomer: Customer, updatedAccount?: Account) => void;
}

const SAVINGS_PACKAGE_OPTIONS: { label: string; value: SavingsPackage }[] = [
  { label: 'GH₵ 5.00 / day (GH₵ 155 monthly target)', value: 5 },
  { label: 'GH₵ 10.00 / day (GH₵ 310 monthly target)', value: 10 },
  { label: 'GH₵ 20.00 / day (GH₵ 620 monthly target)', value: 20 },
  { label: 'GH₵ 30.00 / day (GH₵ 930 monthly target)', value: 30 },
  { label: 'GH₵ 40.00 / day (GH₵ 1,240 monthly target)', value: 40 },
  { label: 'GH₵ 50.00 / day (GH₵ 1,550 monthly target)', value: 50 },
  { label: 'GH₵ 60.00 / day (GH₵ 1,860 monthly target)', value: 60 },
  { label: 'GH₵ 70.00 / day (GH₵ 2,170 monthly target)', value: 70 },
  { label: 'GH₵ 80.00 / day (GH₵ 2,480 monthly target)', value: 80 },
  { label: 'GH₵ 90.00 / day (GH₵ 2,790 monthly target)', value: 90 },
  { label: 'GH₵ 100.00 / day (GH₵ 3,100 monthly target)', value: 100 },
  { label: 'GH₵ 200.00 / day (GH₵ 6,200 monthly target)', value: 200 },
];

class ModalErrorBoundary extends React.Component<{ onClose: () => void; children: React.ReactNode }, { hasError: boolean; errorText: string }> {
  constructor(props: { onClose: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorText: error?.message || 'An error occurred while displaying the editor.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-rose-500/40 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <ExclamationTriangleIcon className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 dark:text-white">Unable to Load Edit Modal</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{this.state.errorText}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorText: '' });
                this.props.onClose();
              }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-bold hover:bg-slate-300"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const EditCustomerRecordModal: React.FC<EditCustomerRecordModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <ModalErrorBoundary onClose={props.onClose}>
      <EditCustomerRecordModalContent {...props} />
    </ModalErrorBoundary>
  );
};

const EditCustomerRecordModalContent: React.FC<EditCustomerRecordModalProps> = ({
  customer,
  account,
  currentUser,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser: authUser } = useAuth();
  const effectiveUser = currentUser || authUser;
  const roleUpper = (effectiveUser?.role || '').toUpperCase();
  const isSuperAdmin = 
    roleUpper === 'SUPER_ADMIN' || 
    roleUpper === 'ADMIN' ||
    (effectiveUser?.email && effectiveUser.email.toLowerCase().includes('superadmin')) || 
    (effectiveUser?.email === 'nanaquasi1992nk@gmail.com');

  // Fallback to resolve customer from account or storage if needed
  const resolvedCustomer = useMemo(() => {
    if (customer) return customer;
    if (account?.customer) return account.customer;
    if (account?.customerId) {
      return getStoredCustomers().find(c => c.id === account.customerId || c.customerNumber === account.customerId) || null;
    }
    return null;
  }, [customer, account]);

  // Active associated account
  const activeAccount = useMemo(() => {
    if (account) return account;
    if (!resolvedCustomer) return null;
    const all = getStoredAccounts();
    return (
      all.find(
        (a) =>
          a.customerId === resolvedCustomer.id ||
          a.customer?.id === resolvedCustomer.id ||
          a.customer?.customerNumber === resolvedCustomer.customerNumber
      ) || null
    );
  }, [account, resolvedCustomer?.id, resolvedCustomer?.customerNumber, isOpen]);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [ghanaCardNumber, setGhanaCardNumber] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [branchId, setBranchId] = useState('br-01');

  // Next of Kin State
  const [nokName, setNokName] = useState('');
  const [nokPhone, setNokPhone] = useState('');
  const [nokRelationship, setNokRelationship] = useState('Family');

  // Financial Ledger State
  const [savingsPackage, setSavingsPackage] = useState<SavingsPackage>(20);
  const [totalDeposited, setTotalDeposited] = useState<number>(0);

  // Correction Memo & Status State
  const [correctionReason, setCorrectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Initialize fields once whenever modal opens or active customer changes
  useEffect(() => {
    if (resolvedCustomer && isOpen) {
      setFirstName(resolvedCustomer.firstName || '');
      setOtherNames(resolvedCustomer.otherNames || '');
      setLastName(resolvedCustomer.lastName || '');
      setPhone(resolvedCustomer.phone || '');
      setGhanaCardNumber(resolvedCustomer.ghanaCardNumber || '');
      setAddress(resolvedCustomer.address || '');
      setOccupation(resolvedCustomer.occupation || '');
      setMonthlyIncome(resolvedCustomer.monthlyIncome || 0);
      setBranchId(resolvedCustomer.branchId || 'br-01');

      setNokName(resolvedCustomer.nextOfKin?.fullName || '');
      setNokPhone(resolvedCustomer.nextOfKin?.phone || '');
      setNokRelationship(resolvedCustomer.nextOfKin?.relationship || 'Family');

      const pkg = activeAccount?.savingsPackage || resolvedCustomer.accounts?.[0]?.savingsPackage || 20;
      const bal = activeAccount?.currentBalance ?? (resolvedCustomer.accounts?.[0]?.currentBalance || 0);

      setSavingsPackage(pkg as SavingsPackage);
      setTotalDeposited(bal);
      setCorrectionReason('');
      setErrorMessage(null);
      setSuccessNotice(null);
    }
  }, [resolvedCustomer?.id, isOpen]);

  if (!isOpen || !resolvedCustomer) return null;

  // Real-time calculation previews
  const currentPkg = savingsPackage || 20;
  const computedDaysPaid = Math.floor((totalDeposited || 0) / currentPkg);
  const isFeeDeducted = computedDaysPaid >= 31;
  const feeAmount = isFeeDeducted ? currentPkg : 0;
  const computedAvailableBalance = isFeeDeducted 
    ? Math.max(0, toDecimal((totalDeposited || 0) - feeAmount))
    : toDecimal(totalDeposited || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isSuperAdmin) {
      setErrorMessage('Authorization Error: Only the Super Administrator has access to edit customer records and savings ledgers.');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Customer first and last name are required.');
      return;
    }

    if (!phone || phone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit Ghanaian mobile number.');
      return;
    }

    if (!ghanaCardNumber.trim() || !ghanaCardNumber.includes('GHA-')) {
      setErrorMessage('Please provide a valid Ghana Card PIN (format: GHA-XXXXXXXXX-X).');
      return;
    }

    if (!correctionReason.trim() || correctionReason.trim().length < 5) {
      setErrorMessage('Please write a valid administrative reason/memo for this ledger correction (at least 5 characters).');
      return;
    }

    const adminActor: User = (effectiveUser && (effectiveUser.role === 'SUPER_ADMIN' || effectiveUser.role === 'ADMIN'))
      ? { ...effectiveUser, role: 'SUPER_ADMIN' }
      : {
          id: 'usr-super-admin',
          employeeId: 'EMP-SA01',
          firstName: effectiveUser?.firstName || 'Super',
          lastName: effectiveUser?.lastName || 'Admin',
          email: effectiveUser?.email || 'superadmin@erikon.com',
          phone: effectiveUser?.phone || '0240000000',
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        };

    setIsSubmitting(true);
    try {
      const result = superAdminUpdateCustomerAndSavings({
        customerId: resolvedCustomer.id,
        firstName,
        otherNames,
        lastName,
        phone,
        ghanaCardNumber,
        address,
        occupation,
        monthlyIncome,
        branchId,
        nextOfKin: {
          fullName: nokName,
          phone: nokPhone,
          relationship: nokRelationship,
        },
        savingsPackage,
        totalSavingsDeposited: totalDeposited,
        correctionReason,
        performedBy: adminActor,
      });

      setSuccessNotice(`✅ Record successfully updated! Changes live-broadcasted across all workstations and phones.`);
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(result.customer, result.account);
        }
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Escape key listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div 
        className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-amber-500/40 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-[#0a3866] via-slate-900 to-[#1e1b4b] text-white flex items-center justify-between border-b border-amber-500/30 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <PencilSquareIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-500 text-slate-950">
                  Super Admin Authorization
                </span>
                <span className="font-mono text-xs text-amber-300 font-bold">
                  {resolvedCustomer.customerNumber}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                Edit & Correct Customer Record
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cancel"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Access Restriction Notice if not Super Admin */}
        {!isSuperAdmin ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
              <LockClosedIcon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Super Administrator Permission Required
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Only the Super Administrator has authorization to modify customer identity or financial ledger balances to ensure strict auditing compliance.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm cursor-pointer hover:bg-slate-200"
            >
              Close Window
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
            <div className="p-5 sm:p-6 space-y-6 flex-1 overflow-y-auto">
              
              {/* Feedback Banners */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successNotice && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 shrink-0" />
                  <span>{successNotice}</span>
                </div>
              )}

              {/* 1. Customer KYC Identity Section */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                  <UserIcon className="w-4 h-4 text-amber-500" />
                  <span>Customer Identity & Contact Information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 font-semibold text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Other Names
                    </label>
                    <input
                      type="text"
                      value={otherNames}
                      onChange={(e) => setOtherNames(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 font-semibold text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Last Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 font-semibold text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ghana Card PIN <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="GHA-000000000-0"
                        value={ghanaCardNumber}
                        onChange={(e) => setGhanaCardNumber(e.target.value.toUpperCase())}
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 font-mono font-bold text-slate-900 dark:text-white outline-none"
                      />
                      <IdentificationIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <GhanaPhoneInput
                      value={phone}
                      onChange={setPhone}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Residential / Business Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Occupation
                    </label>
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                {/* Next of Kin */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    Next of Kin Details
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={nokName}
                        onChange={(e) => setNokName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <GhanaPhoneInput
                        value={nokPhone}
                        onChange={setNokPhone}
                        placeholder="Phone Number"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Relationship (e.g. Spouse, Brother)"
                        value={nokRelationship}
                        onChange={(e) => setNokRelationship(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Financial Ledger & Savings Package Section */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                  <BanknotesIcon className="w-4 h-4 text-emerald-500" />
                  <span>Savings Scheme Package & Total Deposited Balance</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Daily Savings Package <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={savingsPackage}
                      onChange={(e) => setSavingsPackage(Number(e.target.value) as SavingsPackage)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                    >
                      {SAVINGS_PACKAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Correct Total Deposited Amount (GH₵) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">GH₵</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        required
                        value={totalDeposited}
                        onChange={(e) => setTotalDeposited(parseFloat(e.target.value) || 0)}
                        className="w-full pl-12 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono font-black text-slate-900 dark:text-white outline-none text-base"
                      />
                    </div>
                  </div>
                </div>

                {/* Real-time Ledger Preview Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-teal-500/5 to-slate-900/10 border border-amber-500/30 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      Equivalent Days Covered
                    </span>
                    <span className="text-sm font-black font-mono text-amber-500">
                      Day {computedDaysPaid} / 31
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      Fee Retained Status
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                      isFeeDeducted 
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {isFeeDeducted ? `GH₵ ${feeAmount} Retained` : 'Pending Day 31'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      Available Balance
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-500">
                      GH₵ {Number(computedAvailableBalance || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Mandatory Super Admin Justification Memo */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                  <DocumentTextIcon className="w-4 h-4 text-purple-500" />
                  <span>Mandatory Correction Memo (Audit Trail Log) <span className="text-rose-500">*</span></span>
                </div>

                <textarea
                  required
                  rows={2}
                  placeholder="Explain reason for alteration (e.g. Field officer recorded initial deposit as GH₵ 50 instead of GH₵ 100 on client card, and typo in Ghana card number)..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                Signed by: <b className="text-slate-700 dark:text-slate-200">{effectiveUser?.firstName || 'Super'} {effectiveUser?.lastName || 'Admin'}</b> (Super Admin)
              </span>

              <div className="flex items-center space-x-2.5 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Saving & Broadcasting...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="w-4 h-4" />
                      <span>Save & Apply Correction</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
