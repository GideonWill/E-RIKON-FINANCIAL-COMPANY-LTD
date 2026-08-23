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
  MOCK_BRANCHES 
} from '../services/api';
import { subscribeRealtimeEvents, broadcastRealtimeEvent } from '../services/realtimeSync';
import { Customer, Account, SavingsPackage, SAVINGS_PACKAGES, Transaction, DailyCollectionCycle } from '../types';
import { GhanaCardModal } from '../components/ui/GhanaCardModal';
import { GhanaCardInput } from '../components/ui/GhanaCardInput';
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
  TrendingUp,
  Landmark,
  ExternalLink,
  ChevronRight,
  Check
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>(getStoredCustomers());
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGhanaCardCustomer, setSelectedGhanaCardCustomer] = useState<Customer | null>(null);
  const [selectedDetailCustomer, setSelectedDetailCustomer] = useState<Customer | null>(null);
  const [selectedDetailCycleNumber, setSelectedDetailCycleNumber] = useState<number | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [successBanner, setSuccessBanner] = useState<{
    customerName: string;
    customerNumber: string;
    packageRate: number;
    amountPaid: number;
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
  useEffect(() => {
    const unsub = subscribeRealtimeEvents(() => {
      setCustomers(getStoredCustomers());
      setAccounts(getStoredAccounts());
    });
    return unsub;
  }, []);

  // Helper to calculate comprehensive financial summary for any customer (and specific cycle)
  const getCustomerFinancialSummary = (cust: Customer, targetCycleNo?: number | null) => {
    const acc = accounts.find((a) => a.customerId === cust.id) || cust.accounts?.[0];
    const cycles = acc?.dailyCycles && acc.dailyCycles.length > 0 ? acc.dailyCycles : [];
    const activeCycle = targetCycleNo
      ? (cycles.find((c) => c.cycleNumber === targetCycleNo) || cycles[0])
      : cycles[0];
    
    const packageRate = acc?.savingsPackage || activeCycle?.dailyTargetAmount || 20;
    const daysPaid = activeCycle?.currentDayCount || 0;
    const totalDeposited = activeCycle?.totalDeposited !== undefined
      ? activeCycle.totalDeposited
      : (daysPaid * packageRate);
    const isDay31FeeRetained = daysPaid >= 31 || (activeCycle?.feeDeducted === true);
    const companyFeeAmount = isDay31FeeRetained ? (activeCycle?.companyFeeAmount || packageRate) : 0;
    const availableSavings = acc?.availableBalance !== undefined 
      ? acc.availableBalance 
      : Math.max(0, (acc?.currentBalance || totalDeposited) - companyFeeAmount);

    return {
      acc,
      allCycles: cycles,
      activeCycle,
      cycleNumber: activeCycle?.cycleNumber || 1,
      packageRate,
      daysPaid,
      totalDeposited,
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

  // Dynamic calculations for deposit & upfront package fee
  const depositNum = Number(initialDepositAmount) || 0;
  const packageFee = chosenPackage;
  const totalPayable = depositNum + packageFee;
  const splitPreview = depositNum > 0 ? splitPaymentIntoDays(chosenPackage, depositNum, 0) : null;

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ghanaCardNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm);

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

    // 2. Ghana Card Validation
    let rawCard = formData.ghanaCardNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (rawCard.startsWith('GHA')) rawCard = rawCard.slice(3);
    if (!rawCard) {
      setFormError('⚠️ Please enter the Customer Ghana Card PIN (e.g. 722104918-3).');
      return;
    }
    const finalGhanaCard = rawCard.length === 10
      ? `GHA-${rawCard.slice(0, 9)}-${rawCard.slice(9, 10)}`
      : formData.ghanaCardNumber.startsWith('GHA-')
      ? formData.ghanaCardNumber
      : `GHA-${formData.ghanaCardNumber}`;

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
        branchId: 'br-01',
        branch: MOCK_BRANCHES[0],
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

      // Multi-day split calculation for savings deposit
      const currentDayCount = splitPreview ? splitPreview.daysCovered : (depositNum >= chosenPackage ? Math.floor(depositNum / chosenPackage) : (depositNum > 0 ? 1 : 0));
      const totalDeposited = depositNum;
      const availableBalance = depositNum;

      const initialCycle: DailyCollectionCycle = {
        id: `cyc-${Date.now()}`,
        cycleNumber: 1,
        currentDayCount: currentDayCount,
        dailyTargetAmount: chosenPackage,
        totalDeposited: totalDeposited,
        feeDeducted: true, // Upfront package fee policy applied
        companyFeeAmount: packageFee,
        isCompleted: currentDayCount >= 31,
        dailySplits: splitPreview?.entries || (depositNum > 0 ? [{
          dayNumber: 1,
          date: new Date().toISOString().split('T')[0],
          amount: depositNum,
          receiptNo: `RCP-INIT-${Date.now().toString().slice(-4)}-1`,
          isCompanyFee: false,
        }] : []),
      };

      // Create Savings Account on the chosen package
      const newAcc: Account = {
        id: `acc-${Date.now()}`,
        accountNumber: `ACC-1001-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: newCustId,
        customer: newCust,
        branchId: 'br-01',
        branch: MOCK_BRANCHES[0],
        type: 'SAVINGS',
        savingsPackage: chosenPackage,
        currentBalance: totalDeposited,
        availableBalance: availableBalance,
        interestRate: 0.00,
        status: 'ACTIVE',
        openingDate: new Date().toISOString(),
        dailyCycles: [initialCycle],
      };

      const currentCusts = getStoredCustomers();
      const updatedCusts = [newCust, ...currentCusts];
      setCustomers(updatedCusts);
      saveStoredCustomers(updatedCusts);

      const existingAccs = getStoredAccounts();
      saveStoredAccounts([newAcc, ...existingAccs]);

      // Automatically accumulate the upfront package fee for E-RIKON Company Interest
      accumulateCompanyInterest(newAcc, 1, packageFee);

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
          remarks: `Opening savings deposit on GH₵ ${chosenPackage}/day package (Days covered: ${currentDayCount}). Upfront fee of GH₵ ${packageFee} settled.`,
          createdAt: new Date().toISOString(),
        };
        newTxs.push(depTx);
      }

      const feeTx: Transaction = {
        id: `tx-fee-${Date.now()}`,
        referenceNo: `TX-FEE-${Date.now().toString().slice(-8)}`,
        receiptNo: `RCP-FEE-${Date.now().toString().slice(-8)}`,
        accountId: newAcc.id,
        account: newAcc,
        type: 'COMPANY_FEE_DEDUCTION',
        paymentMode: 'PHYSICAL_CASH',
        amount: packageFee,
        previousBal: depositNum,
        newBal: depositNum,
        remarks: `Upfront package enrollment fee (GH₵ ${packageFee}) collected & retained for GH₵ ${chosenPackage}/day package cycle`,
        createdAt: new Date().toISOString(),
      };
      newTxs.push(feeTx);

      saveStoredTransactions([...newTxs, ...txs]);

      // Broadcast across all connected staff devices in real-time
      broadcastRealtimeEvent('CUSTOMER_CREATED', newCust);

      // Close modal, clear search filter, and show new customer immediately
      setShowRegisterModal(false);
      setSearchTerm('');
      setJustAddedId(newCustId);
      setSuccessBanner({
        customerName: `${newCust.firstName} ${newCust.lastName}`,
        customerNumber: newCustNo,
        packageRate: chosenPackage,
        amountPaid: totalPayable,
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
                  Customer Record Created
                </span>
                <span className="font-mono text-xs font-bold text-amber-500">{successBanner.customerNumber}</span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                {successBanner.customerName} Onboarded Successfully!
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Package: <b>GH₵ {successBanner.packageRate}.00 / Day</b>
                {successBanner.amountPaid > 0 && (
                  <span> • Initial Payment: <b>GH₵ {successBanner.amountPaid.toFixed(2)}</b> ({successBanner.daysCovered} Days Spread)</span>
                )}
              </p>
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
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold border shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedPackageFilter === null
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
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold border shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-500/30 font-black'
                    : count > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-500/40'
                }`}
                title={`Filter clients in GH₵ ${pkg}/Day package`}
              >
                <span>GH₵ {pkg}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isSelected
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
            placeholder="Search by name, phone, Ghana Card PIN (GHA-XXXXXXXXX-X), or customer number..."
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
            className={`p-6 rounded-3xl bg-white dark:bg-slate-900 border transition-all space-y-4 relative overflow-hidden cursor-pointer group hover:border-amber-500 hover:shadow-xl hover:scale-[1.01] ${
              isJustAdded
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

            {/* Financial Performance Highlights: Package, Days Paid, Balance, 31-Day Company Fee */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-500" /> Package Tier
                </span>
                <div className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs">
                  GH₵ {fin.packageRate}/Day
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <CalendarCheck className="w-3 h-3 text-blue-500" /> Days Paid
                </span>
                <div className="font-mono font-black text-slate-900 dark:text-white text-xs">
                  {fin.daysPaid} / 31 Days
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-emerald-500" /> Balance
                </span>
                <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                  GH₵ {fin.availableSavings.toFixed(2)}
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-purple-500" /> 31-Day Co. Fee
                </span>
                <div className="font-mono font-bold text-xs truncate">
                  {fin.isDay31FeeRetained ? (
                    <span className="text-purple-600 dark:text-purple-400 font-black">
                      GH₵ {fin.packageRate}.00 (Retained)
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[10px]">
                      Due Day 31 (GH₵ {fin.packageRate})
                    </span>
                  )}
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

              <div className="flex items-center space-x-3 shrink-0">
                <span className="text-[11px] font-bold text-amber-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 flex items-center gap-1">
                  <span>View 360 Financial Details</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCustomer(cust);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-bold border border-rose-500/30 transition-all flex items-center gap-1 text-xs cursor-pointer"
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
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => {
              setSelectedDetailCustomer(null);
              setSelectedDetailCycleNumber(null);
            }}
          >
            <div 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[94vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-800 to-slate-900 border-2 border-amber-500/40 text-amber-500 text-xl font-mono font-black flex items-center justify-center shrink-0 shadow-md">
                    {selectedDetailCustomer.firstName[0]}{selectedDetailCustomer.lastName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-500">{selectedDetailCustomer.customerNumber}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        {selectedDetailCustomer.status}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mt-0.5">
                      {selectedDetailCustomer.firstName} {selectedDetailCustomer.otherNames || ''} {selectedDetailCustomer.lastName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                      <span>Ghana Card: <b className="font-mono text-slate-800 dark:text-slate-200">{selectedDetailCustomer.ghanaCardNumber}</b></span>
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setSelectedDetailCustomer(null);
                    setSelectedDetailCycleNumber(null);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cycle History Tab Switcher */}
              {fin.allCycles.length > 0 && (
                <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
                  <span className="text-[10px] font-black text-slate-400 uppercase px-2 shrink-0">
                    Cycle Records:
                  </span>
                  {fin.allCycles.map((c) => {
                    const isSelected = fin.cycleNumber === c.cycleNumber;
                    return (
                      <button
                        key={c.cycleNumber}
                        type="button"
                        onClick={() => setSelectedDetailCycleNumber(c.cycleNumber)}
                        className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-500/40'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-amber-500 border border-slate-200 dark:border-slate-800'
                        }`}
                        title={`Switch to view detailed records of Cycle #${c.cycleNumber}`}
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Cycle #{c.cycleNumber}</span>
                        <span className="text-[10px] opacity-80">
                          {c.isCompleted || c.currentDayCount >= 31 ? '• (Completed 31/31)' : `• (${c.currentDayCount}/31 Days)`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 360 Financial Metrics Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* 1. Daily Package Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 space-y-1">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5" /> Savings Package
                  </span>
                  <div className="text-xl font-black font-mono text-amber-500">
                    GH₵ {fin.packageRate}.00
                  </div>
                  <p className="text-[10px] text-slate-500">Daily Target Tier</p>
                </div>

                {/* 2. Days Paid Progress Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 space-y-1.5">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5" /> Days Paid Progress
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black font-mono text-blue-500">
                      {fin.daysPaid} <span className="text-xs text-slate-400 font-sans">/ 31 Days</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-500">{percentCompleted}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${percentCompleted}%` }}
                    />
                  </div>
                </div>

                {/* 3. Available Net Savings Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border-2 border-emerald-500/40 space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Current Balance
                  </span>
                  <div className="text-xl font-black font-mono text-emerald-500">
                    GH₵ {fin.availableSavings.toFixed(2)}
                  </div>
                  <p className="text-[10px] text-slate-500">Available in Client Vault</p>
                </div>

              </div>

              {/* Company Management Fee (31 Days) Alert Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-500" />
                    Company 31-Day Management Fee
                  </span>
                  <span className="font-mono text-xs font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/30">
                    GH₵ {fin.packageRate}.00 (1 Day Package Value)
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {fin.isDay31FeeRetained ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-4 h-4" /> Day 31 reached! GH₵ {fin.packageRate}.00 management fee has been retained by E-RiKON Financial Company PLC and recorded to corporate interest revenue.
                    </span>
                  ) : (
                    <span>
                      Client has completed <b>{fin.daysPaid} of 31 days</b> (Total Deposited: <b>GH₵ {fin.totalDeposited.toFixed(2)}</b>). Upon reaching <b>Day 31</b>, 1 day's package value (<b>GH₵ {fin.packageRate}.00</b>) will be retained as management fee.
                    </span>
                  )}
                </p>
              </div>

              {/* 31-Day Collection Cycle Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    31-Day Collection Cycle Split Days
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Cycle 1 • {fin.daysPaid} / 31 Recorded
                  </span>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                  {Array.from({ length: 31 }, (_, idx) => {
                    const dayNo = idx + 1;
                    const isPaid = dayNo <= fin.daysPaid;
                    const isDay31 = dayNo === 31;
                    return (
                      <div
                        key={dayNo}
                        className={`p-1.5 rounded-xl border text-center font-mono text-[10px] transition-all ${
                          isDay31
                            ? isPaid
                              ? 'bg-purple-500/20 border-purple-500 text-purple-600 dark:text-purple-400 font-black'
                              : 'bg-purple-500/5 border-purple-500/30 text-purple-400 font-medium'
                            : isPaid
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                        title={
                          isDay31
                            ? `Day 31: Company 1-Day Management Fee (GH₵ ${fin.packageRate})`
                            : `Day ${dayNo}: GH₵ ${fin.packageRate} ${isPaid ? 'PAID' : 'PENDING'}`
                        }
                      >
                        <div className="font-extrabold">D{dayNo}</div>
                        <div className="text-[9px] mt-0.5">
                          {isPaid ? `GH₵${fin.packageRate}` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Personal & Next of Kin Profile */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <h4 className="font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider text-xs flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <User className="w-4 h-4 text-amber-500" />
                  <span>Client Contact & Next of Kin</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold block uppercase tracking-wider">
                      Phone Contact
                    </span>
                    <span className="font-black font-mono text-sm text-slate-950 dark:text-white block">
                      {selectedDetailCustomer.phone}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold block uppercase tracking-wider">
                      Occupation
                    </span>
                    <span className="font-black text-sm text-slate-950 dark:text-white block">
                      {selectedDetailCustomer.occupation || 'Not Specified'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold block uppercase tracking-wider">
                      Residential Address
                    </span>
                    <span className="font-black text-sm text-slate-950 dark:text-white block">
                      {selectedDetailCustomer.address || 'Not Specified'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-extrabold block uppercase tracking-wider">
                      Next of Kin
                    </span>
                    <div className="font-black text-sm text-slate-950 dark:text-white block">
                      {selectedDetailCustomer.nextOfKin?.fullName || 'Not Specified'} 
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                        ({selectedDetailCustomer.nextOfKin?.relationship || 'Family'})
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block mt-1">
                        📞 {selectedDetailCustomer.nextOfKin?.phone || selectedDetailCustomer.phone}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetailCustomer(null);
                    navigate('/teller');
                  }}
                  className="w-full sm:flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
                >
                  <Landmark className="w-4 h-4" />
                  <span>Record Deposit on Teller</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetailCustomer(null);
                    navigate('/reports');
                  }}
                  className="w-full sm:flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Financial Statement</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDetailCustomer(null)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-bold cursor-pointer"
                >
                  Close
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
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowRegisterModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
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
                    <span>Ghana Card Number *</span>
                    <span className="text-[10px] text-amber-500 font-mono">Format: GHA-XXXXXXXXX-X</span>
                  </label>
                  <div className="mt-1">
                    <GhanaCardInput
                      required
                      value={formData.ghanaCardNumber}
                      onChange={(formatted) => updateFormField('ghanaCardNumber', formatted)}
                      placeholder="722104918-3"
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
                        className={`py-2 px-1 rounded-xl font-mono text-xs font-extrabold border transition-all cursor-pointer text-center ${
                          isSelected
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
                        className={`w-full pl-11 pr-3 py-2 rounded-xl bg-slate-800 border text-white font-mono font-black text-sm focus:outline-none ${
                          depositNum < chosenPackage || depositNum % chosenPackage !== 0
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

                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                      <span className="text-[10px] text-amber-400/90 block font-medium">Upfront Cycle Fee</span>
                      <span className="font-mono font-black text-amber-300 text-sm">GH₵ {packageFee}.00 (Retained)</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40">
                      <span className="text-[10px] text-emerald-300 block font-medium">Total Cash Required</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">GH₵ {totalPayable}.00</span>
                    </div>
                  </div>

                  {/* Early Withdrawal Guarantee Policy Note */}
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <b>1-Day Retained Fee Rule:</b> 1 day's package contribution is retained as the E-RIKON management fee. If a client deposits across any days and withdraws before Day 31 (e.g., <b>GH₵ 25.00 for 5 days on the GH₵ 5 package</b>), 1 day (<b>GH₵ 5.00</b>) is retained as the fee and <b>GH₵ 20.00 (4 days)</b> is paid out to the client.
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
