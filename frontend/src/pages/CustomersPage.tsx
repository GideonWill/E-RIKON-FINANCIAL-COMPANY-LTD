import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getStoredCustomers,
  saveStoredCustomers,
  getStoredAccounts,
  saveStoredAccounts,
  deleteCustomerRecord,
  splitPaymentIntoDays,
  getStoredTransactions,
  saveStoredTransactions,
  accumulateCompanyInterest,
  startNewCycleForAccount
} from '../services/api';
import { subscribeRealtimeEvents, broadcastRealtimeEvent, useRealtimeSync } from '../services/realtimeSync';
import { pushLocalToCloud } from '../services/cloudSync';
import { Customer, Account, SavingsPackage, SAVINGS_PACKAGES, Transaction, DailyCollectionCycle, DailySplitEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { GhanaCardModal } from '../components/ui/GhanaCardModal';
import { GhanaCardInput, formatGhanaCardNumber, isValidGhanaCard } from '../components/ui/GhanaCardInput';
import { GhanaPhoneInput, isValidGhanaPhone, formatGhanaianPhoneNumber } from '../components/ui/GhanaPhoneInput';
import {
  Users,
  User,
  UserPlus,
  Search,
  ShieldCheck,
  CreditCard,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  FileText,
  Calendar,
  X,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Coins,
  Sparkles,
  CalendarCheck,
  Filter,
  Wallet,
  Clock,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Landmark,
  ExternalLink,
  ChevronRight,
  Check
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>(getStoredCustomers());
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [transactions, setTransactions] = useState<Transaction[]>(getStoredTransactions());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGhanaCardCustomer, setSelectedGhanaCardCustomer] = useState<Customer | null>(null);
  const [selectedDetailCustomer, setSelectedDetailCustomer] = useState<Customer | null>(null);
  const [selectedDetailCycleNumber, setSelectedDetailCycleNumber] = useState<number | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [successBanner, setSuccessBanner] = useState<{
    customerName: string;
    customerNumber: string;
    packageRate: number;
    amountStartedWith: number;
    availableSavings: number;
    companyFee: number;
    daysCovered: number;
  } | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const packageParam = searchParams.get('package');
  const [selectedPackageFilter, setSelectedPackageFilter] = useState<number | null>(
    packageParam ? Number(packageParam) : null
  );

  // Sync state when URL query param changes
  useEffect(() => {
    const pkg = searchParams.get('package');
    setSelectedPackageFilter(pkg ? Number(pkg) : null);
  }, [searchParams]);

  // Subscribe to multi-device real-time sync
  useRealtimeSync(() => {
    setCustomers(getStoredCustomers());
    setAccounts(getStoredAccounts());
    setTransactions(getStoredTransactions());
  });

  // Helper to calculate comprehensive financial summary for any customer (and specific cycle)
  const getCustomerFinancialSummary = (cust: Customer, targetCycleNo?: number | null) => {
    const acc = accounts.find((a) => a.customerId === cust.id) || getStoredAccounts().find((a) => a.customerId === cust.id) || cust.accounts?.[0];
    const cycles = acc?.dailyCycles && acc.dailyCycles.length > 0 ? acc.dailyCycles : [];
    const activeCycle = targetCycleNo
      ? (cycles.find((c) => c.cycleNumber === targetCycleNo) || cycles[0])
      : cycles[0];

    const packageRate = acc?.savingsPackage || activeCycle?.dailyTargetAmount || 20;
    const daysPaid = activeCycle?.currentDayCount || 0;
    
    // Total deposited across all cycles
    const totalDepositedAcrossCycles = cycles.reduce((sum, c) => sum + (c.totalDeposited || 0), 0) || (acc?.currentBalance || (daysPaid * packageRate));
    
    // Cycle-specific deposit
    const cycleDeposited = activeCycle?.totalDeposited !== undefined
      ? activeCycle.totalDeposited
      : (daysPaid * packageRate);

    // Customer transactions & withdrawals
    const customerTransactions = transactions.filter(
      (t) => t.accountId === acc?.id || t.account?.customerId === cust.id || t.account?.customer?.id === cust.id
    );
    const customerWithdrawals = customerTransactions.filter((t) => t.type === 'WITHDRAWAL');
    const totalWithdrawn = customerWithdrawals.reduce((sum, t) => sum + t.amount, 0);

    const isDay31FeeRetained = daysPaid >= 31 || (activeCycle?.feeDeducted === true);
    const companyFeeAmount = isDay31FeeRetained ? (activeCycle?.companyFeeAmount || packageRate) : 0;
    
    // Available Net Savings Balance (always cumulative current balance, preserved across cycles if not withdrawn)
    const availableSavings = acc?.availableBalance !== undefined
      ? acc.availableBalance
      : Math.max(0, totalDepositedAcrossCycles - (isDay31FeeRetained ? companyFeeAmount : 0) - totalWithdrawn);

    return {
      acc,
      allCycles: cycles,
      activeCycle,
      cycleNumber: activeCycle?.cycleNumber || 1,
      packageRate,
      daysPaid,
      totalDeposited: cycleDeposited,
      totalDepositedAcrossCycles,
      totalWithdrawn,
      customerWithdrawals,
      customerTransactions,
      isDay31FeeRetained,
      companyFeeAmount,
      availableSavings,
      dailySplits: activeCycle?.dailySplits || [],
    };
  };

  // Helper to get client package
  const getCustomerPackage = (cust: Customer): number => {
    return getCustomerFinancialSummary(cust).packageRate;
  };

  // Package member counts
  const packageCounts = SAVINGS_PACKAGES.reduce((acc, pkg) => {
    acc[pkg] = customers.filter((c) => getCustomerPackage(c) === pkg).length;
    return acc;
  }, {} as Record<number, number>);

  const handleSelectPackageFilter = (pkg: number | null) => {
    setSelectedPackageFilter(pkg);
    if (pkg !== null) {
      setSearchParams({ package: pkg.toString() });
    } else {
      setSearchParams({});
    }
  };

  // New Customer Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    otherNames: '',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    phone: '',
    email: '',
    address: '',
    ghanaCardNumber: '',
    occupation: '',
    employerName: '',
    monthlyIncome: '3500',
    nokName: '',
    nokRelation: '',
    nokPhone: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [chosenPackage, setChosenPackage] = useState<SavingsPackage>(20);
  const [initialDepositAmount, setInitialDepositAmount] = useState<string>('20');

  // Auto-dismiss error banner after 4 seconds
  useEffect(() => {
    if (formError) {
      const timer = setTimeout(() => {
        setFormError(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [formError]);

  // Immediately clear error banner when user begins typing/interacting with any field
  const updateFormField = (field: keyof typeof formData, value: string) => {
    if (formError) setFormError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Dynamic calculations for deposit & upfront package fee (fee deducted from deposit)
  const depositNum = Number(initialDepositAmount) || 0;
  const packageFee = chosenPackage;
  const totalPayable = depositNum;
  const netCreditedSavings = Math.max(0, depositNum - packageFee);
  const splitPreview = depositNum > 0 ? splitPaymentIntoDays(chosenPackage, depositNum, 0) : null;

  const filteredCustomers = customers.filter((c) => {
    const rawSearch = searchTerm.trim().toLowerCase();
    if (!rawSearch) {
      return selectedPackageFilter !== null ? getCustomerPackage(c) === selectedPackageFilter : true;
    }

    const firstName = (c.firstName || '').toLowerCase();
    const lastName = (c.lastName || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    const revFullName = `${lastName} ${firstName}`.trim();
    const custNumber = (c.customerNumber || '').toLowerCase();
    const ghanaCard = (c.ghanaCardNumber || '').toLowerCase();
    const ghanaCardNoHyphen = ghanaCard.replace(/-/g, '');
    const phone = (c.phone || '').replace(/\s+/g, '');
    const cleanSearch = rawSearch.replace(/\s+/g, ' ');
    const cleanSearchNoHyphen = cleanSearch.replace(/-/g, '');

    // Check direct matching across whole queries
    const directMatch =
      fullName.includes(cleanSearch) ||
      revFullName.includes(cleanSearch) ||
      firstName.includes(cleanSearch) ||
      lastName.includes(cleanSearch) ||
      custNumber.includes(cleanSearch) ||
      ghanaCard.includes(cleanSearch) ||
      ghanaCardNoHyphen.includes(cleanSearchNoHyphen) ||
      phone.includes(cleanSearch.replace(/\s+/g, ''));

    // Check multi-word tokens (e.g. "kwame djan")
    const searchTokens = cleanSearch.split(' ').filter(Boolean);
    const tokensMatch = searchTokens.every(
      (tok) =>
        fullName.includes(tok) ||
        custNumber.includes(tok) ||
        ghanaCard.includes(tok) ||
        ghanaCardNoHyphen.includes(tok.replace(/-/g, '')) ||
        phone.includes(tok)
    );

    const matchesSearch = directMatch || tokensMatch;
    if (!matchesSearch) return false;

    if (selectedPackageFilter !== null) {
      return getCustomerPackage(c) === selectedPackageFilter;
    }

    return true;
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Name Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setFormError('⚠️ Please enter the Customer First Name and Last Name.');
      return;
    }

    // 2. Ghana Card PIN Validation (Fixed Format GHA-XXXXXXXXX-X)
    const finalGhanaCard = formatGhanaCardNumber(formData.ghanaCardNumber);
    if (!isValidGhanaCard(finalGhanaCard)) {
      setFormError('⚠️ Ghana Card PIN must be in the valid fixed format GHA-XXXXXXXXX-X (e.g. GHA-000568509-7).');
      return;
    }

    // 3. Phone Number Validation (Must be exactly 10 digits starting with 0)
    const cleanPhone = formatGhanaianPhoneNumber(formData.phone);
    if (!cleanPhone || cleanPhone.length !== 10 || !cleanPhone.startsWith('0')) {
      setFormError('⚠️ Phone Contact must be exactly 10 digits starting with 0 (e.g. 0241234567).');
      return;
    }

    // 4. Next of Kin Phone (if provided, must be valid 10 digits)
    const cleanNokPhone = formData.nokPhone ? formatGhanaianPhoneNumber(formData.nokPhone) : '';
    if (formData.nokPhone && cleanNokPhone.length !== 10) {
      setFormError('⚠️ Next of Kin Phone must be 10 digits starting with 0 (e.g. 0241234567).');
      return;
    }

    // 5. Package Deposit Validation (Must be >= chosenPackage and exact multiple)
    if (depositNum < chosenPackage) {
      setFormError(`⚠️ Deposit amount cannot be lower than the chosen package rate (GH₵ ${chosenPackage}.00). Minimum deposit is GH₵ ${chosenPackage}.00.`);
      return;
    }

    if (depositNum % chosenPackage !== 0) {
      setFormError(`⚠️ Deposit amount (GH₵ ${depositNum}.00) must be an exact multiple of the GH₵ ${chosenPackage}.00 package (e.g. GH₵ ${chosenPackage}, GH₵ ${chosenPackage * 2}, GH₵ ${chosenPackage * 3}) to split evenly across days.`);
      return;
    }

    try {
      const newCustId = `cust-${Date.now()}`;
      const newCustNo = `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      const newCust: Customer = {
        id: newCustId,
        customerNumber: newCustNo,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        otherNames: formData.otherNames.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        phone: cleanPhone,
        email: formData.email.trim(),
        address: formData.address.trim() || 'Accra, Ghana',
        ghanaCardNumber: finalGhanaCard,
        occupation: formData.occupation.trim() || 'Self Employed',
        monthlyIncome: Number(formData.monthlyIncome) || 0,
        status: 'VERIFIED',
        createdAt: new Date().toISOString(),
        nextOfKin: {
          id: `nok-${Date.now()}`,
          fullName: formData.nokName.trim() || 'Not Specified',
          relationship: formData.nokRelation.trim() || 'Family',
          phone: cleanNokPhone || cleanPhone,
          address: formData.address.trim() || 'Accra, Ghana',
        },
      };

      // Multi-day split calculation for savings deposit (Days 1-30 are 100% savings, Day 31 is retention fee)
      const currentDayCount = splitPreview ? splitPreview.daysCovered : (depositNum >= chosenPackage ? Math.floor(depositNum / chosenPackage) : (depositNum > 0 ? 1 : 0));
      const totalDeposited = depositNum;
      const isDay31Reached = currentDayCount >= 31;
      const feeDeducted = isDay31Reached;
      const companyFeeAmount = isDay31Reached ? chosenPackage : 0;
      const availableBalance = isDay31Reached ? Math.max(0, depositNum - chosenPackage) : depositNum;

      const generatedSplits: DailySplitEntry[] = (splitPreview?.entries && splitPreview.entries.length > 0)
        ? splitPreview.entries
        : (currentDayCount > 0
          ? Array.from({ length: currentDayCount }, (_, i) => ({
              dayNumber: i + 1,
              date: new Date().toISOString().split('T')[0],
              amount: chosenPackage,
              receiptNo: `RCP-INIT-${Date.now().toString().slice(-4)}-${i + 1}`,
              isCompanyFee: i + 1 === 31,
              recordedBy: currentUser ? `${currentUser.firstName} ${currentUser.lastName} (${currentUser.role.replace(/_/g, ' ')})` : 'Gideon Ogunu (SUPER ADMIN)',
              recordedAt: new Date().toISOString(),
              batchTxRef: `TX-INIT-${Date.now().toString().slice(-8)}`,
            }))
          : []);

      const initialCycle: DailyCollectionCycle = {
        id: `cyc-${newCustId.replace('cust-', '')}`,
        cycleNumber: 1,
        currentDayCount: currentDayCount,
        dailyTargetAmount: chosenPackage,
        totalDeposited: totalDeposited,
        feeDeducted,
        companyFeeAmount,
        isCompleted: isDay31Reached,
        startDate: new Date().toISOString().split('T')[0],
        dailySplits: generatedSplits,
      };

      // Create Savings Account on the chosen package
      const newAcc: Account = {
        id: `acc-${newCustId.replace('cust-', '')}`,
        accountNumber: `ACC-1001-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: newCustId,
        customer: newCust,
        type: 'SAVINGS',
        savingsPackage: chosenPackage,
        currentBalance: totalDeposited,
        availableBalance: availableBalance,
        interestRate: 0.00,
        status: 'ACTIVE',
        openingDate: new Date().toISOString(),
        dailyCycles: [initialCycle],
      };

      // Link account to customer and vice versa
      newCust.accounts = [newAcc];

      // Save accounts FIRST so getStoredAccounts() never creates a blank 20gh fallback!
      const existingAccs = getStoredAccounts();
      const updatedAccs = [newAcc, ...existingAccs.filter((a) => a.id !== newAcc.id && a.customerId !== newCust.id)];
      saveStoredAccounts(updatedAccs);
      setAccounts(updatedAccs);

      const currentCusts = getStoredCustomers();
      const updatedCusts = [newCust, ...currentCusts.filter(c => c.id !== newCust.id)];
      saveStoredCustomers(updatedCusts);
      setCustomers(updatedCusts);

      // Accumulate company interest only if Day 31 was reached
      if (isDay31Reached) {
        accumulateCompanyInterest(newAcc, 1, chosenPackage);
      }

      // Record ledger deposit transaction & upfront fee transaction
      const txs = getStoredTransactions();
      const newTxs: Transaction[] = [];

      if (depositNum > 0) {
        const depTx: Transaction = {
          id: `tx-init-${Date.now()}`,
          referenceNo: `TX-INIT-${Date.now().toString().slice(-8)}`,
          receiptNo: `RCP-INIT-${Date.now().toString().slice(-8)}`,
          accountId: newAcc.id,
          account: newAcc,
          type: 'DEPOSIT',
          paymentMode: 'PHYSICAL_CASH',
          amount: depositNum,
          previousBal: 0,
          newBal: availableBalance,
          recordedBy: currentUser || undefined,
          remarks: `Opening savings deposit on GH₵ ${chosenPackage}/day package (Days covered: ${currentDayCount}).`,
          createdAt: new Date().toISOString(),
        };
        newTxs.push(depTx);
      }

      const allUpdatedTxs = [...newTxs, ...txs];
      setTransactions(allUpdatedTxs);
      saveStoredTransactions(allUpdatedTxs);

      // Broadcast across all connected staff devices in real-time
      broadcastRealtimeEvent('CUSTOMER_CREATED', newCust);
      broadcastRealtimeEvent('ACCOUNT_OPENED', newAcc);
      if (depositNum > 0 && newTxs.length > 0) {
        broadcastRealtimeEvent('DEPOSIT_RECORDED', newTxs[0]);
      }
      broadcastRealtimeEvent('MANUAL_SYNC', {});
      pushLocalToCloud().catch(() => {});

      // Close modal, clear search filter, and show new customer immediately
      setShowRegisterModal(false);
      setSearchTerm('');
      setJustAddedId(newCustId);
      setSuccessBanner({
        customerName: `${newCust.firstName} ${newCust.lastName}`,
        customerNumber: newCustNo,
        packageRate: chosenPackage,
        amountStartedWith: depositNum,
        availableSavings: availableBalance,
        companyFee: packageFee,
        daysCovered: currentDayCount,
      });

      setFormData({
        firstName: '',
        lastName: '',
        otherNames: '',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        phone: '',
        email: '',
        address: '',
        ghanaCardNumber: '',
        occupation: '',
        employerName: '',
        monthlyIncome: '3500',
        nokName: '',
        nokRelation: '',
        nokPhone: '',
      });
      setInitialDepositAmount(chosenPackage.toString());

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setFormError(`⚠️ Registration Error: ${err?.message || 'Failed to save record'}`);
    }
  };

  const handleDeleteCustomer = (cust: Customer) => {
    const confirmed = window.confirm(
      `⚠️ Delete & Close Client Record?\n\nClient Name: ${cust.firstName} ${cust.lastName}\nGhana Card PIN: ${cust.ghanaCardNumber}\nCustomer ID: ${cust.customerNumber}\n\nAre you sure this client does not want to save anymore? This will permanently close their daily savings accounts and ledger records.`
    );
    if (confirmed) {
      deleteCustomerRecord(cust.id);
      setCustomers(getStoredCustomers());
      setAccounts(getStoredAccounts());
      if (selectedDetailCustomer?.id === cust.id) {
        setSelectedDetailCustomer(null);
        setSelectedDetailCycleNumber(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Newly Onboarded Success Banner */}
      {successBanner && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/20 via-emerald-500/10 to-transparent border-2 border-amber-500/50 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                  Account Created & Funded
                </span>
                <span className="font-mono text-xs font-bold text-amber-500">{successBanner.customerNumber}</span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                {successBanner.customerName} Account Created Successfully!
              </h4>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mt-1 font-mono">
                <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold">
                  Package: GH₵ {successBanner.packageRate}.00/Day
                </span>
                <span className="bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-black">
                  Amount Started With: GH₵ {successBanner.amountStartedWith.toFixed(2)} ({successBanner.daysCovered} Days Spread)
                </span>
                <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-black">
                  Available Savings: GH₵ {successBanner.availableSavings.toFixed(2)}
                </span>
                <span className="bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md font-bold">
                  1-Day Fee: GH₵ {successBanner.companyFee.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Customer 360 & Ghana Card Onboarding
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            National Identity Authority (NIA) Verified Client Database & Daily Savings Account Directory
          </p>
        </div>

        <button
          onClick={() => setShowRegisterModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Ghana Cedis Savings Package Category Filter Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-amber-500" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Filter by Savings Package Tier
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            {selectedPackageFilter !== null && (
              <button
                type="button"
                onClick={() => handleSelectPackageFilter(null)}
                className="text-[11px] font-bold text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Package Filter</span>
              </button>
            )}
            <span className="text-[11px] font-mono text-slate-400">
              {customers.length} total client{customers.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* 12 Package Pills + All Button */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => handleSelectPackageFilter(null)}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold border shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${selectedPackageFilter === null
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-500/30 font-black'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-500/40'
              }`}
          >
            <span>All Packages</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10">
              {customers.length}
            </span>
          </button>

          {SAVINGS_PACKAGES.map((pkg) => {
            const isSelected = selectedPackageFilter === pkg;
            const count = packageCounts[pkg] || 0;
            return (
              <button
                type="button"
                key={pkg}
                onClick={() => handleSelectPackageFilter(isSelected ? null : pkg)}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold border shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-500/30 font-black'
                    : count > 0
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-500/40'
                  }`}
                title={`Filter clients in GH₵ ${pkg}/Day package`}
              >
                <span>GH₵ {pkg}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected
                      ? 'bg-slate-950 text-white font-bold'
                      : count > 0
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Package Filter Banner Alert */}
      {selectedPackageFilter !== null && (
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Showing only clients registered under the <b>GH₵ {selectedPackageFilter}.00 / Day</b> package ({filteredCustomers.length} registered {filteredCustomers.length === 1 ? 'client' : 'clients'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSelectPackageFilter(null)}
            className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-600 text-[11px] font-black cursor-pointer transition-all shrink-0"
          >
            Show All Clients
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, Ghana ID number, or customer number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
          <span className="font-bold text-amber-500">{filteredCustomers.length}</span> matching record{filteredCustomers.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {searchTerm ? 'No Matching Customers Found' : 'No Customers Registered Yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm
                ? 'Try adjusting your search query (Name, Ghana Card #, Phone).'
                : 'Start onboarding genuine clients with Ghana Card verification to open daily savings accounts.'}
            </p>
          </div>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register First Customer</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCustomers.map((cust) => {
            const isJustAdded = cust.id === justAddedId;
            const fin = getCustomerFinancialSummary(cust);
            return (
              <div
                key={cust.id}
                onClick={() => setSelectedDetailCustomer(cust)}
                className={`p-6 rounded-3xl bg-white dark:bg-slate-900 border transition-all space-y-4 relative overflow-hidden cursor-pointer group hover:border-amber-500 hover:shadow-xl hover:scale-[1.01] ${isJustAdded
                    ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-2xl shadow-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 shadow-sm'
                  }`}
                title="Click to view 360 financial overview, days paid, and savings balance"
              >
                {/* Just Onboarded Badge */}
                {isJustAdded && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-3 h-3" /> Just Onboarded
                  </div>
                )}

                {/* Top Row: Client Badge & Name */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-800 to-slate-900 border-2 border-amber-500/40 shadow-sm flex items-center justify-center font-mono font-black text-amber-500 text-lg shrink-0 group-hover:scale-105 transition-transform">
                      {cust.firstName[0]}{cust.lastName[0]}
                    </div>
                    <div>
                      <div className="text-[11px] font-mono text-amber-500 font-extrabold flex items-center gap-2">
                        <span>{cust.customerNumber}</span>
                        <span className="text-[10px] text-slate-400 font-normal">• {fin.acc?.accountNumber || 'ACC-SAVINGS'}</span>
                      </div>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight group-hover:text-amber-500 transition-colors">
                        {cust.firstName} {cust.otherNames || ''} {cust.lastName}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" /> {cust.occupation}
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> {cust.status}
                  </span>
                </div>

                {/* Financial Performance Highlights: Total Savings, Total Withdrawals, Net Balance, Daily Package */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-blue-500" /> Total Savings
                    </span>
                    <div className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs">
                      GH₵ {fin.totalDepositedAcrossCycles.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      Cycle #{fin.cycleNumber} ({fin.daysPaid}/31 Days)
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <ArrowDownLeft className="w-3 h-3 text-rose-500" /> Total Withdrawals
                    </span>
                    <div className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs">
                      GH₵ {fin.totalWithdrawn.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {fin.customerWithdrawals.length} Withdrawal(s)
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-emerald-500" /> Net Balance
                    </span>
                    <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                      GH₵ {fin.availableSavings.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-emerald-500 font-mono font-bold">
                      Available in Vault
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Coins className="w-3 h-3 text-amber-500" /> Package Tier
                    </span>
                    <div className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs">
                      GH₵ {fin.packageRate}/Day
                    </div>
                    <div className="text-[9px] text-purple-500 font-mono font-bold truncate">
                      {fin.isDay31FeeRetained ? 'Fee Settled' : '31-Day Cycle'}
                    </div>
                  </div>
                </div>

                {/* Middle Grid: Ghana Card & Phone */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/70 text-xs border border-slate-100 dark:border-slate-800/60">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-amber-500" /> Ghana Card PIN
                    </span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {cust.ghanaCardNumber}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                      <Phone className="w-3 h-3 text-blue-500" /> Phone Contact
                    </span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {cust.phone}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Address & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px] truncate">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {cust.address}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (fin.acc?.id) {
                          navigate('/accounts', { state: { accountId: fin.acc.id } });
                        } else {
                          setSelectedDetailCustomer(cust);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30 transition-all flex items-center gap-1 text-[11px] cursor-pointer"
                      title="View 31-day scheme visual calendar"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>31-Day Scheme</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDetailCustomer(cust);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 font-bold text-slate-800 dark:text-slate-200 transition-all flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <span>360 Dossier</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomer(cust);
                      }}
                      className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-bold border border-rose-500/30 transition-all flex items-center gap-1 text-xs cursor-pointer"
                      title="Close and delete client record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Customer 360 Financial Overview & Days Paid Modal */}
      {selectedDetailCustomer && (() => {
        const fin = getCustomerFinancialSummary(selectedDetailCustomer, selectedDetailCycleNumber);
        const percentCompleted = Math.min(100, Math.round((fin.daysPaid / 31) * 100));

        return (
          <div
            className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => {
              setSelectedDetailCustomer(null);
              setSelectedDetailCycleNumber(null);
            }}
          >
            <div
              className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[32px] sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-200"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile Drag Pill */}
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden" />

              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-800 to-slate-900 border-2 border-amber-500/40 text-amber-500 text-lg sm:text-xl font-mono font-black flex items-center justify-center shrink-0 shadow-md">
                    {selectedDetailCustomer.firstName[0]}{selectedDetailCustomer.lastName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-mono text-[11px] sm:text-xs font-bold text-amber-500">{selectedDetailCustomer.customerNumber}</span>
                      <span className="px-2 py-0.2 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        {selectedDetailCustomer.status}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white mt-0.5">
                      {selectedDetailCustomer.firstName} {selectedDetailCustomer.otherNames || ''} {selectedDetailCustomer.lastName}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <CreditCard className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Ghana Card: <b className="font-mono text-slate-800 dark:text-slate-200">{selectedDetailCustomer.ghanaCardNumber}</b></span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomer(selectedDetailCustomer)}
                    className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="Close & Delete Client Account"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden md:inline">Delete Record</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDetailCustomer(null);
                      setSelectedDetailCycleNumber(null);
                    }}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    title="Close Modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Cycle History Tab Switcher */}
              {fin.allCycles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="p-1.5 sm:p-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase px-1.5 shrink-0">
                        Cycles:
                      </span>
                      {fin.allCycles.map((c) => {
                        const isSelected = fin.cycleNumber === c.cycleNumber;
                        const isCompleted = c.isCompleted || c.currentDayCount >= 31;
                        return (
                          <button
                            key={c.cycleNumber}
                            type="button"
                            onClick={() => setSelectedDetailCycleNumber(c.cycleNumber)}
                            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl font-mono text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${isSelected
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-500/40'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-amber-500 border border-slate-200 dark:border-slate-800'
                              }`}
                            title={`View Cycle #${c.cycleNumber}`}
                          >
                            <Coins className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Cycle #{c.cycleNumber}</span>
                            <span className="text-[9px] opacity-80">
                              {isCompleted ? '• (31/31)' : `• (${c.currentDayCount}/31)`}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {(fin.allCycles[0]?.isCompleted || fin.allCycles[0]?.currentDayCount >= 31) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (fin.acc?.id) {
                            startNewCycleForAccount(fin.acc.id, currentUser || undefined);
                            const fresh = getStoredAccounts();
                            setAccounts(fresh);
                            const updatedAcc = fresh.find((a) => a.id === fin.acc?.id);
                            if (updatedAcc?.dailyCycles?.[0]) {
                              setSelectedDetailCycleNumber(updatedAcc.dailyCycles[0].cycleNumber);
                            }
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-[10px] sm:text-[11px] font-black shrink-0 flex items-center gap-1 shadow-md shadow-emerald-500/20 cursor-pointer transition-all"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Start Next Cycle</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 360 Financial Metrics Highlights 2x2 Grid on Mobile, 4-col on Desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">

                {/* 1. Daily Package Card */}
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 space-y-0.5 shadow-2xs">
                  <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1 truncate">
                    <Coins className="w-3 h-3 text-amber-500 shrink-0" /> Daily Target
                  </span>
                  <div className="text-base sm:text-xl font-black font-mono text-amber-500">
                    GH₵ {fin.packageRate}.00
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 truncate">Package Rate / Day</p>
                </div>

                {/* 2. Total Client Savings Deposited */}
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent border-2 border-blue-500/40 space-y-0.5 shadow-2xs">
                  <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1 truncate">
                    <TrendingUp className="w-3 h-3 text-blue-500 shrink-0" /> Total Savings
                  </span>
                  <div className="text-base sm:text-xl font-black font-mono text-blue-500">
                    GH₵ {fin.totalDepositedAcrossCycles.toFixed(2)}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 truncate">Gross (All Cycles)</p>
                </div>

                {/* 3. Total Client Withdrawals */}
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent border-2 border-rose-500/40 space-y-0.5 shadow-2xs">
                  <span className="text-[9px] sm:text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1 truncate">
                    <ArrowDownLeft className="w-3 h-3 text-rose-500 shrink-0" /> Withdrawals
                  </span>
                  <div className="text-base sm:text-xl font-black font-mono text-rose-500">
                    GH₵ {fin.totalWithdrawn.toFixed(2)}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 truncate">{fin.customerWithdrawals.length} Record(s)</p>
                </div>

                {/* 4. Net Client Balance */}
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border-2 border-emerald-500/40 space-y-0.5 shadow-2xs">
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1 truncate">
                    <Wallet className="w-3 h-3 text-emerald-500 shrink-0" /> Net Balance
                  </span>
                  <div className="text-base sm:text-xl font-black font-mono text-emerald-500">
                    GH₵ {fin.availableSavings.toFixed(2)}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-emerald-500 font-bold truncate">Available in Vault</p>
                </div>

              </div>

              {/* Company Management Fee (31 Days) Alert Banner */}
              <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    Company 31-Day Fee (Cycle #{fin.cycleNumber})
                  </span>
                  <span className="font-mono text-[11px] sm:text-xs font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/30 w-fit">
                    GH₵ {fin.packageRate}.00 (1-Day Fee)
                  </span>
                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300">
                  {fin.isDay31FeeRetained ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 shrink-0" /> Day 31 reached! GH₵ {fin.packageRate}.00 retained to corporate interest revenue.
                    </span>
                  ) : (
                    <span>
                      Completed <b>{fin.daysPaid} of 31 days</b> (Deposited: <b>GH₵ {fin.totalDeposited.toFixed(2)}</b>). On Day 31, 1 day's package (<b>GH₵ {fin.packageRate}.00</b>) is retained.
                    </span>
                  )}
                </p>
              </div>

              {/* 31-Day Collection Cycle Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    31-Day Split Days (Cycle #{fin.cycleNumber})
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    {fin.daysPaid} / 31 Recorded ({percentCompleted}%)
                  </span>
                </div>

                <div className="grid grid-cols-7 sm:grid-cols-11 gap-1 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                  {Array.from({ length: 31 }, (_, idx) => {
                    const dayNo = idx + 1;
                    const isPaid = dayNo <= fin.daysPaid;
                    const isDay31 = dayNo === 31;
                    return (
                      <div
                        key={dayNo}
                        className={`p-1 rounded-xl border text-center font-mono text-[9px] sm:text-[10px] transition-all ${isDay31
                            ? isPaid
                              ? 'bg-purple-500/20 border-purple-500 text-purple-600 dark:text-purple-400 font-black'
                              : 'bg-purple-500/5 border-purple-500/30 text-purple-400 font-medium'
                            : isPaid
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                          }`}
                        title={
                          isDay31
                            ? `Day 31: Company 1-Day Fee (GH₵ ${fin.packageRate})`
                            : `Day ${dayNo}: GH₵ ${fin.packageRate} ${isPaid ? 'PAID' : 'PENDING'}`
                        }
                      >
                        <div className="font-extrabold">D{dayNo}</div>
                        <div className="text-[8px] sm:text-[9px] mt-0.5">
                          {isPaid ? `GH₵${fin.packageRate}` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Account Transactions & Withdrawals Ledger */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                    <span>Client Activity Ledger</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    {fin.customerTransactions.length} Record(s)
                  </span>
                </div>

                {fin.customerTransactions.length === 0 ? (
                  <div className="p-3 text-center rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                    No individual counter transactions recorded yet for this client.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {fin.customerTransactions.map((tx: any) => {
                      const isWithdrawal = tx.type === 'WITHDRAWAL';
                      const isFee = tx.type === 'COMPANY_FEE_DEDUCTION';
                      return (
                        <div
                          key={tx.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className={`p-1.5 rounded-lg shrink-0 ${
                              isWithdrawal ? 'bg-rose-500/10 text-rose-500' : isFee ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              {isWithdrawal ? <ArrowDownLeft className="w-3.5 h-3.5" /> : isFee ? <Building2 className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-black text-[10px] ${
                                  isWithdrawal ? 'text-rose-600 dark:text-rose-400' : isFee ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'
                                }`}>
                                  {isWithdrawal ? 'WITHDRAWAL' : isFee ? 'COMPANY FEE' : 'DEPOSIT'}
                                </span>
                                <span className="font-mono text-[9px] text-slate-400">
                                  {tx.receiptNo || tx.referenceNo}
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-500 truncate mt-0.5">
                                {tx.remarks || `Recorded by ${tx.recordedBy?.firstName || 'Staff'}`}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className={`font-mono font-black text-[11px] sm:text-xs ${
                              isWithdrawal ? 'text-rose-500' : isFee ? 'text-purple-500' : 'text-emerald-500'
                            }`}>
                              {isWithdrawal ? '-' : '+'}GH₵ {tx.amount.toFixed(2)}
                            </div>
                            <div className="text-[8px] sm:text-[9px] font-mono text-slate-400">
                              Bal: GH₵ {tx.newBal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Personal & Next of Kin Profile */}
              <div className="p-3 sm:p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <h4 className="font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px] sm:text-xs flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <User className="w-3.5 h-3.5 text-amber-500" />
                  <span>Client Contact & Next of Kin</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-0.5">
                    <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold block uppercase tracking-wider">
                      Phone Contact
                    </span>
                    <span className="font-black font-mono text-xs sm:text-sm text-slate-950 dark:text-white block truncate">
                      {selectedDetailCustomer.phone}
                    </span>
                  </div>

                  <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-0.5">
                    <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold block uppercase tracking-wider">
                      Occupation
                    </span>
                    <span className="font-black text-xs sm:text-sm text-slate-950 dark:text-white block truncate">
                      {selectedDetailCustomer.occupation || 'Not Specified'}
                    </span>
                  </div>

                  <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-0.5 col-span-2 sm:col-span-1">
                    <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold block uppercase tracking-wider">
                      Residential Address
                    </span>
                    <span className="font-black text-xs sm:text-sm text-slate-950 dark:text-white block truncate">
                      {selectedDetailCustomer.address || 'Not Specified'}
                    </span>
                  </div>

                  <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-0.5 col-span-2 sm:col-span-1">
                    <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold block uppercase tracking-wider">
                      Next of Kin
                    </span>
                    <div className="font-black text-xs sm:text-sm text-slate-950 dark:text-white block truncate">
                      {selectedDetailCustomer.nextOfKin?.fullName || 'Not Specified'}
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 ml-1">
                        ({selectedDetailCustomer.nextOfKin?.relationship || 'Family'})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons (Grid 2x2 on Mobile, Flex Row on Desktop) */}
              <div className="pt-1 grid grid-cols-2 sm:flex sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const accId = fin.acc?.id;
                    setSelectedDetailCustomer(null);
                    navigate('/teller', { state: { accountId: accId, mode: 'DEPOSIT' } });
                  }}
                  className="py-2.5 sm:py-3 sm:flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Deposit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const accId = fin.acc?.id;
                    setSelectedDetailCustomer(null);
                    navigate('/teller', { state: { accountId: accId, mode: 'WITHDRAWAL' } });
                  }}
                  className="py-2.5 sm:py-3 sm:flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer transition-all"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Withdraw</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (fin.acc?.id) {
                      setSelectedDetailCustomer(null);
                      navigate('/accounts', { state: { accountId: fin.acc.id } });
                    }
                  }}
                  className="py-2.5 sm:py-3 sm:flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 font-bold text-slate-900 dark:text-white text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>31-Day Scheme</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetailCustomer(null);
                    navigate('/reports');
                  }}
                  className="py-2.5 sm:py-3 sm:flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Statement</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Ghana Card Modal */}
      <GhanaCardModal
        customer={selectedGhanaCardCustomer}
        onClose={() => setSelectedGhanaCardCustomer(null)}
      />

      {/* Register Customer Modal */}
      {showRegisterModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setShowRegisterModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                Register New Customer (Ghana Card Onboarding)
              </h3>
              <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
              {/* Form Error Banner */}
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/80 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">First Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateFormField('firstName', e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:border-amber-500"
                    placeholder="e.g. Kwame"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Last Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateFormField('lastName', e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:border-amber-500"
                    placeholder="e.g. Mensah"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                    <span>Ghana ID Number *</span>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono">Numbers only</span>
                  </label>
                  <div className="mt-1">
                    <GhanaCardInput
                      required
                      value={formData.ghanaCardNumber}
                      onChange={(val) => updateFormField('ghanaCardNumber', val)}
                      placeholder="Enter Ghana ID (numbers only)"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                    <span>Phone Contact (10 Digits) *</span>
                    <span className="text-[10px] text-amber-500 font-mono">e.g. 0241234567</span>
                  </label>
                  <div className="mt-1">
                    <GhanaPhoneInput
                      required
                      value={formData.phone}
                      onChange={(phone) => updateFormField('phone', phone)}
                      placeholder="0241234567"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Occupation *</label>
                  <input
                    required
                    type="text"
                    value={formData.occupation}
                    onChange={(e) => updateFormField('occupation', e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:border-amber-500"
                    placeholder="Trader, Engineer, Teacher"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Residential Address *</label>
                  <input
                    required
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateFormField('address', e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:border-amber-500"
                    placeholder="Osu RE, Accra"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-amber-500 uppercase tracking-wider text-[11px]">Next of Kin Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Next of Kin Name"
                    value={formData.nokName}
                    onChange={(e) => updateFormField('nokName', e.target.value)}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Relationship (e.g. Spouse)"
                    value={formData.nokRelation}
                    onChange={(e) => updateFormField('nokRelation', e.target.value)}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:border-amber-500"
                  />
                  <GhanaPhoneInput
                    value={formData.nokPhone}
                    onChange={(phone) => updateFormField('nokPhone', phone)}
                    placeholder="NOK Phone (024...)"
                  />
                </div>
              </div>

              {/* Savings Package Selection & Initial Deposit */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-amber-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      Choose Daily Savings Package (Ghana Cedis) *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Select client daily contribution tier (5 to 200 GHS / day)
                    </p>
                  </div>
                  <span className="font-mono text-xs font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30">
                    GH₵ {chosenPackage}.00 / Day
                  </span>
                </div>

                {/* 12 Package Buttons Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {SAVINGS_PACKAGES.map((pkg) => {
                    const isSelected = chosenPackage === pkg;
                    return (
                      <button
                        type="button"
                        key={pkg}
                        onClick={() => {
                          if (formError) setFormError(null);
                          setChosenPackage(pkg);
                          setInitialDepositAmount(pkg.toString());
                        }}
                        className={`py-2 px-1 rounded-xl font-mono text-xs font-extrabold border transition-all cursor-pointer text-center ${isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-500/30'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500/50'
                          }`}
                      >
                        GH₵ {pkg}
                      </button>
                    );
                  })}
                </div>

                {/* Upfront Package Fee & Initial Savings Breakdown Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 text-white space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                        <CalendarCheck className="w-4 h-4 text-emerald-400" />
                        Savings Deposit (Day 1 / Multi-Day Advance)
                      </label>
                      <span className="text-[10px] text-slate-400">Credited to customer's available savings balance</span>
                    </div>
                    <div className="relative w-full sm:w-44">
                      <span className="absolute left-3 top-2.5 font-bold text-amber-400 text-xs">GH₵</span>
                      <input
                        type="number"
                        min={chosenPackage}
                        step={chosenPackage}
                        value={initialDepositAmount}
                        onChange={(e) => {
                          if (formError) setFormError(null);
                          setInitialDepositAmount(e.target.value);
                        }}
                        style={{ color: '#ffffff' }}
                        className={`w-full pl-11 pr-3 py-2 rounded-xl bg-slate-800 border text-white font-mono font-black text-sm focus:outline-none ${depositNum < chosenPackage || depositNum % chosenPackage !== 0
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                          }`}
                        placeholder={chosenPackage.toString()}
                      />
                    </div>
                  </div>

                  {/* Live Splittability Feedback */}
                  {depositNum > 0 && depositNum < chosenPackage && (
                    <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>Deposit cannot be lower than the GH₵ {chosenPackage}.00 package rate. Minimum deposit is GH₵ {chosenPackage}.00.</span>
                    </div>
                  )}

                  {depositNum >= chosenPackage && depositNum % chosenPackage !== 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>
                        GH₵ {depositNum}.00 cannot split evenly into GH₵ {chosenPackage}/day. Must be an exact multiple (e.g. GH₵ {chosenPackage}, GH₵ {chosenPackage * 2}, GH₵ {chosenPackage * 3}).
                      </span>
                    </div>
                  )}

                  {depositNum >= chosenPackage && depositNum % chosenPackage === 0 && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span>
                        ✓ GH₵ {depositNum}.00 splits perfectly into <b>{depositNum / chosenPackage} day(s)</b> ({depositNum / chosenPackage} × GH₵ {chosenPackage}.00/day).
                      </span>
                    </div>
                  )}

                  {/* Summary Breakdown Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                      <span className="text-[10px] text-slate-400 block font-medium">Daily Savings Package</span>
                      <span className="font-mono font-black text-amber-400 text-sm">GH₵ {chosenPackage}.00 / day</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40">
                      <span className="text-[10px] text-emerald-300 block font-medium">Total Cash Required</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">GH₵ {totalPayable}.00</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                      <span className="text-[10px] text-teal-300 block font-medium">Credited to Savings (Days 1–30)</span>
                      <span className="font-mono font-black text-teal-400 text-sm">GH₵ {depositNum}.00</span>
                    </div>
                  </div>

                  {/* 30-Day Cycle & Retention Policy Note */}
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <b>30-Day Savings & Company Retention Policy:</b> Clients contribute daily according to package (GH₵ {chosenPackage}/Day). The company retains 1 day's contribution (<b>GH₵ {chosenPackage}.00</b>) directly from the deposited money upon reaching the 31st contribution day. Mid-cycle withdrawals are issued as <b>loans against accumulated savings</b>, with the 1-day retention fee strictly safeguarded and never eaten into.
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Form Error Alert */}
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/80 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-4 flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer text-xs"
                >
                  Confirm & Onboard Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
