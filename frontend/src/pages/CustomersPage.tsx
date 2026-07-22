import React, { useState, useEffect } from 'react';
import { 
  getStoredCustomers, 
  saveStoredCustomers, 
  getStoredAccounts, 
  saveStoredAccounts, 
  MOCK_BRANCHES 
} from '../services/api';
import { subscribeRealtimeEvents, broadcastRealtimeEvent } from '../services/realtimeSync';
import { Customer, Account } from '../types';
import { GhanaCardModal } from '../components/ui/GhanaCardModal';
import { GhanaCardInput } from '../components/ui/GhanaCardInput';
import { 
  Users, 
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
  CheckCircle2
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(getStoredCustomers());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGhanaCardCustomer, setSelectedGhanaCardCustomer] = useState<Customer | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Subscribe to multi-device real-time sync
  useEffect(() => {
    const unsub = subscribeRealtimeEvents(() => {
      setCustomers(getStoredCustomers());
    });
    return unsub;
  }, []);

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

  const filteredCustomers = customers.filter(
    (c) =>
      c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ghanaCardNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalGhanaCard = formData.ghanaCardNumber.startsWith('GHA-')
      ? formData.ghanaCardNumber
      : `GHA-${formData.ghanaCardNumber}`;

    const newCustId = `cust-${Date.now()}`;
    const newCustNo = `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCust: Customer = {
      id: newCustId,
      customerNumber: newCustNo,
      firstName: formData.firstName,
      lastName: formData.lastName,
      otherNames: formData.otherNames,
      dateOfBirth: formData.dateOfBirth,
      gender: formData.gender,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      ghanaCardNumber: finalGhanaCard,
      passportPhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      occupation: formData.occupation,
      monthlyIncome: Number(formData.monthlyIncome),
      branchId: 'br-01',
      branch: MOCK_BRANCHES[0],
      status: 'VERIFIED',
      createdAt: new Date().toISOString(),
      nextOfKin: {
        id: `nok-${Date.now()}`,
        fullName: formData.nokName,
        relationship: formData.nokRelation,
        phone: formData.nokPhone,
        address: formData.address,
      },
    };

    // Auto-create initial Savings Account for this new client
    const newAcc: Account = {
      id: `acc-${Date.now()}`,
      accountNumber: `ACC-1001-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: newCustId,
      customer: newCust,
      branchId: 'br-01',
      branch: MOCK_BRANCHES[0],
      type: 'SAVINGS',
      currentBalance: 0.00,
      availableBalance: 0.00,
      interestRate: 0.00,
      status: 'ACTIVE',
      openingDate: new Date().toISOString(),
      dailyCycles: [
        {
          id: `cyc-${Date.now()}`,
          cycleNumber: 1,
          currentDayCount: 0,
          dailyTargetAmount: 100.00,
          totalDeposited: 0.00,
          feeDeducted: false,
          companyFeeAmount: 0.00,
          isCompleted: false,
        },
      ],
    };

    const updatedCusts = [newCust, ...customers];
    setCustomers(updatedCusts);
    saveStoredCustomers(updatedCusts);

    const existingAccs = getStoredAccounts();
    saveStoredAccounts([newAcc, ...existingAccs]);

    // Broadcast across all connected staff devices in real-time
    broadcastRealtimeEvent('CUSTOMER_CREATED', newCust);

    setShowRegisterModal(false);
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
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            Customer Management 360
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Register, Verify, and Inspect Client Identification Records (Ghana Card NIA Format: GHA-XXXXXXXXX-X)
          </p>
        </div>

        <button
          onClick={() => setShowRegisterModal(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition-all text-xs cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search customer by Name, Customer #, Ghana Card GHA-xxxx, or Phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
        />
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCustomers.map((cust) => (
          <div
            key={cust.id}
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4 relative overflow-hidden"
          >
            {/* Top Row: Passport & Name */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <img
                  src={cust.passportPhotoUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'}
                  alt={cust.firstName}
                  className="w-14 h-14 object-cover rounded-2xl border-2 border-amber-500/40 shadow-sm"
                />
                <div>
                  <div className="text-[11px] font-mono text-amber-500 font-extrabold">{cust.customerNumber}</div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
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

            {/* Middle Grid: Ghana Card & Phone */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 text-xs border border-slate-100 dark:border-slate-800/80">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-amber-500" /> Ghana Card Number
                </span>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {cust.ghanaCardNumber}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                  <Phone className="w-3 h-3 text-blue-500" /> Phone Contact
                </span>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {cust.phone}
                </div>
              </div>
            </div>

            {/* Bottom Row: Address & Actions */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-rose-500" /> {cust.address}
              </div>

              <button
                onClick={() => setSelectedGhanaCardCustomer(cust)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-bold border border-amber-500/30 transition-all flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> View Ghana Card
              </button>
            </div>

          </div>
        ))}
      </div>

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
              <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">First Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    placeholder="e.g. Kwame"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Last Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    placeholder="e.g. Mensah"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                    <span>Ghana Card Number *</span>
                    <span className="text-[10px] text-amber-500 font-mono">Format: GHA-XXXXXXXXX-X</span>
                  </label>
                  <div className="mt-1">
                    <GhanaCardInput
                      required
                      value={formData.ghanaCardNumber}
                      onChange={(formatted) => setFormData({ ...formData, ghanaCardNumber: formatted })}
                      placeholder="722104918-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Phone Contact *</label>
                  <input
                    required
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    placeholder="+233 24 111 2233"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Occupation *</label>
                  <input
                    required
                    type="text"
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    placeholder="Trader, Engineer, Teacher"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Residential Address *</label>
                  <input
                    required
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    placeholder="Osu RE, Accra"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-amber-500 uppercase tracking-wider text-[11px]">Next of Kin Details</h4>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Next of Kin Name"
                    value={formData.nokName}
                    onChange={(e) => setFormData({ ...formData, nokName: e.target.value })}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="Relationship (e.g. Spouse)"
                    value={formData.nokRelation}
                    onChange={(e) => setFormData({ ...formData, nokRelation: e.target.value })}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="NOK Phone"
                    value={formData.nokPhone}
                    onChange={(e) => setFormData({ ...formData, nokPhone: e.target.value })}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Confirm & Onboard Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
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
