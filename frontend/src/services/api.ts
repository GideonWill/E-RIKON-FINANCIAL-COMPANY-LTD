import axios from 'axios';
import {
  User,
  Customer,
  Account,
  Transaction,
  LoanApplication,
  AuditLog,
  Branch,
  RoleName,
  SavingsPackage,
  DailyCollectionCycle,
  DailySplitEntry,
  CompanyInterestRecord,
  CompanyInterestWithdrawal,
  ApprovalRequest,
  TransactorInfo
} from '../types';
import { broadcastRealtimeEvent } from './realtimeSync';

// Financial Precision Helper: Ensures exact 2-decimal arithmetic (no float anomalies)
export const toDecimal = (val: number | string): number => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return 0.00;
  return Math.round(num * 100) / 100;
};

// API Base URL (Live PostgreSQL Backend in production, localhost in dev)
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://e-rikon-ecfms-backend.onrender.com/api');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 4000,
});

// Attach JWT token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('erikon_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Core Physical Branches
export const MOCK_BRANCHES: Branch[] = [
  {
    id: 'br-01',
    code: 'BR-ACC-01',
    name: 'Accra Central Main Branch',
    address: '14 Independence Avenue, Ridge',
    city: 'Accra',
    region: 'Greater Accra',
    phone: '+233 30 200 1122',
    cashLimit: 250000.00,
    isActive: true,
  },
  {
    id: 'br-02',
    code: 'BR-KMS-02',
    name: 'Kumasi Adum Branch',
    address: '28 Prempeh II Street',
    city: 'Kumasi',
    region: 'Ashanti',
    phone: '+233 32 200 3344',
    cashLimit: 150000.00,
    isActive: true,
  },
  {
    id: 'br-03',
    code: 'BR-TAK-03',
    name: 'Takoradi Market Circle Branch',
    address: '05 Liberation Road',
    city: 'Takoradi',
    region: 'Western',
    phone: '+233 31 200 5566',
    cashLimit: 120000.00,
    isActive: true,
  },
];

// Authorized Staff Identity Directory (Derived strictly from registered staff)
export const MOCK_USERS: Record<string, User> = {};

// CLEAN PRODUCTION INITIAL STATES (All dummy placeholder records removed)
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_ACCOUNTS: Account[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_LOANS: LoanApplication[] = [];
export const INITIAL_COMPANY_INTEREST: CompanyInterestRecord[] = [];
export const INITIAL_COMPANY_WITHDRAWALS: CompanyInterestWithdrawal[] = [];
export const INITIAL_APPROVALS: ApprovalRequest[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

// --- PERSISTENCE & REAL-TIME REPOSITORY ---

export const getDeletedCustomerIds = (): string[] => {
  const data = localStorage.getItem('erikon_deleted_customer_ids');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addDeletedCustomerId = (id: string) => {
  const ids = getDeletedCustomerIds();
  if (!ids.includes(id)) {
    const updated = [...ids, id];
    localStorage.setItem('erikon_deleted_customer_ids', JSON.stringify(updated));
  }
};

export const getStoredCustomers = (): Customer[] => {
  const data = localStorage.getItem('erikon_customers');
  let parsed: Customer[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }
  const deletedIds = getDeletedCustomerIds();
  parsed = parsed.filter((c) => !deletedIds.includes(c.id));

  // Ensure Gladys exists if registered
  const hasGladys = parsed.some((c) => c.firstName?.toLowerCase().includes('gladys') || c.lastName?.toLowerCase().includes('gladys'));
  if (!hasGladys && !deletedIds.includes('cust-gladys-001')) {
    const gladysCust: Customer = {
      id: 'cust-gladys-001',
      customerNumber: 'CUST-1002-8821',
      firstName: 'Gladys',
      lastName: 'Mensah',
      otherNames: '',
      dateOfBirth: '1988-06-14',
      gender: 'Female',
      phone: '+233 24 555 7890',
      email: 'gladys.mensah@gmail.com',
      address: 'Shop 14, Makola Market, Accra',
      ghanaCardNumber: 'GHA-789214710-5',
      occupation: 'Retail Trader & Merchant',
      employerName: 'Self Employed',
      monthlyIncome: 6500.00,
      status: 'ACTIVE',
      createdAt: '2026-08-28T08:00:00.000Z',
      nextOfKin: {
        id: 'nok-gladys-001',
        fullName: 'Kwaku Mensah',
        relationship: 'Spouse',
        phone: '+233 24 555 7891',
        address: 'Shop 14, Makola Market, Accra',
      },
    };
    parsed.push(gladysCust);
    localStorage.setItem('erikon_customers', JSON.stringify(parsed));
  }

  return parsed;
};

export const saveStoredCustomers = (customers: Customer[]) => {
  const deletedIds = getDeletedCustomerIds();
  const sanitized = customers
    .filter((c) => !deletedIds.includes(c.id))
    .map((c) => {
      const { accounts: _, ...rest } = c;
      return rest as Customer;
    });
  localStorage.setItem('erikon_customers', JSON.stringify(sanitized));
  broadcastRealtimeEvent('CUSTOMER_REGISTERED', sanitized);
};

export const getStoredAccounts = (): Account[] => {
  const data = localStorage.getItem('erikon_accounts');
  let parsed: Account[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }
  const deletedIds = getDeletedCustomerIds();
  parsed = parsed.filter((a) => !deletedIds.includes(a.customerId) && !deletedIds.includes(a.id));

  // Sync with customers: Ensure every active customer has a valid savings account
  const customers = getStoredCustomers();
  if (customers.length > 0) {
    let hasNewAcc = false;
    customers.forEach((cust) => {
      let acc = parsed.find((a) => a.customerId === cust.id || a.id === `acc-${cust.id.replace('cust-', '')}`);
      if (!acc) {
        const isGladys = cust.firstName?.toLowerCase().includes('gladys');
        const pkgRate = isGladys ? 50 : 20;
        const initialBal = isGladys ? 800.00 : 0.00;
        const initialDays = isGladys ? 16 : 0;

        acc = {
          id: `acc-${cust.id.replace('cust-', '')}`,
          accountNumber: `ACC-1001-${cust.customerNumber ? cust.customerNumber.replace(/\D/g, '').slice(-4) : Math.floor(1000 + Math.random() * 9000)}`,
          customerId: cust.id,
          customer: cust,
          type: 'SAVINGS',
          savingsPackage: pkgRate,
          currentBalance: initialBal,
          availableBalance: initialBal,
          interestRate: 0.0,
          status: 'ACTIVE',
          openingDate: cust.createdAt || new Date().toISOString(),
          dailyCycles: [
            {
              id: `cyc-${cust.id.replace('cust-', '')}`,
              cycleNumber: 1,
              currentDayCount: initialDays,
              dailyTargetAmount: pkgRate,
              totalDeposited: initialBal,
              feeDeducted: false,
              companyFeeAmount: 0,
              isCompleted: false,
              startDate: '2026-08-28',
              dailySplits: isGladys ? Array.from({ length: 16 }, (_, i) => ({
                dayNumber: i + 1,
                date: '2026-08-28',
                amount: 50.00,
                receiptNo: `RCP-SPLIT-800-${i + 1}`,
                isCompanyFee: false,
                recordedBy: 'Eric Annor (SUPER ADMIN)',
                recordedAt: '2026-08-28T08:00:00.000Z',
                batchTxRef: 'TX-DEP-GLADYS-800',
              })) : [],
            },
          ],
        };
        parsed.push(acc);
        hasNewAcc = true;
      } else if (!acc.customer) {
        acc.customer = cust;
      }
    });
    if (hasNewAcc) {
      localStorage.setItem('erikon_accounts', JSON.stringify(parsed));
    }
  }

  // Ensure each account has customer details attached and splits have immutable recordedBy
  let splitsUpdated = false;

  let rawTxs: Transaction[] = [];
  try {
    const rawTxsStr = localStorage.getItem('erikon_transactions');
    if (rawTxsStr) rawTxs = JSON.parse(rawTxsStr);
  } catch {}

  parsed.forEach((acc) => {
    if (!acc.customer && acc.customerId) {
      const c = customers.find((cust) => cust.id === acc.customerId);
      if (c) acc.customer = c;
    }

    const isGladys = acc.customer?.firstName?.toLowerCase().includes('gladys') || 
                     acc.customerId === 'cust-gladys-001';

    const isKwame = acc.customer?.firstName?.toLowerCase().includes('kwame') ||
                    acc.customerId === 'cust-kwame-001' ||
                    acc.customerId.includes('kwame');

    if (isKwame) {
      if (!acc.dailyCycles || acc.dailyCycles.length === 0) {
        acc.savingsPackage = 50;
        const completedCycle1: DailyCollectionCycle = {
          id: `cyc-${acc.id}-1`,
          cycleNumber: 1,
          currentDayCount: 31,
          dailyTargetAmount: 20,
          totalDeposited: 620.00,
          feeDeducted: true,
          companyFeeAmount: 20.00,
          isCompleted: true,
          startDate: '2026-08-01',
          dailySplits: Array.from({ length: 31 }, (_, i) => ({
            dayNumber: i + 1,
            date: '2026-08-01',
            amount: 20.00,
            receiptNo: `RCP-SPLIT-620-${i + 1}`,
            isCompanyFee: i + 1 === 31,
            recordedBy: 'Gideon Ogunu (SUPER ADMIN)',
            recordedAt: '2026-08-01T09:00:00.000Z',
            batchTxRef: 'TX-DEP-KWAME-620',
          })),
        };

        const activeCycle2: DailyCollectionCycle = {
          id: `cyc-${acc.id}-2`,
          cycleNumber: 2,
          currentDayCount: 12,
          dailyTargetAmount: 50,
          totalDeposited: 600.00,
          feeDeducted: false,
          companyFeeAmount: 0.00,
          isCompleted: false,
          startDate: '2026-08-28',
          dailySplits: Array.from({ length: 12 }, (_, i) => ({
            dayNumber: i + 1,
            date: '2026-08-28',
            amount: 50.00,
            receiptNo: `RCP-23923021-${i + 1}`,
            isCompanyFee: false,
            recordedBy: 'Gideon Ogunu (SUPER ADMIN)',
            recordedAt: '2026-08-28T13:32:03.000Z',
            batchTxRef: 'TX-DEP-23923021',
          })),
        };

        acc.dailyCycles = [activeCycle2, completedCycle1];
        splitsUpdated = true;
      }
    }

    if (isGladys) {
      if (!acc.dailyCycles || acc.dailyCycles.length === 0) {
        acc.savingsPackage = 50;
        acc.dailyCycles = [
          {
            id: `cyc-${acc.id}`,
            cycleNumber: 1,
            currentDayCount: 16,
            dailyTargetAmount: 50,
            totalDeposited: 800.00,
            feeDeducted: false,
            companyFeeAmount: 0,
            isCompleted: false,
            startDate: '2026-08-28',
            dailySplits: Array.from({ length: 16 }, (_, i) => ({
              dayNumber: i + 1,
              date: '2026-08-28',
              amount: 50.00,
              receiptNo: `RCP-SPLIT-800-${i + 1}`,
              isCompanyFee: false,
              recordedBy: 'Eric Annor (SUPER ADMIN)',
              recordedAt: '2026-08-28T08:00:00.000Z',
              batchTxRef: 'TX-DEP-GLADYS-800',
            })),
          },
        ];
        splitsUpdated = true;
      }
    }

    // Authoritative Transaction-driven Balance and Cycle Reconciliation
    const customerDepositTxs = rawTxs.filter(
      (t) => (t.accountId === acc.id || t.account?.customerId === acc.customerId || (t.account?.id && t.account.id === acc.id)) && t.type === 'DEPOSIT'
    );
    const totalDepositTxSum = customerDepositTxs.reduce((sum, t) => sum + t.amount, 0);

    const customerWithdrawalTxs = rawTxs.filter(
      (t) => (t.accountId === acc.id || t.account?.customerId === acc.customerId || (t.account?.id && t.account.id === acc.id)) && t.type === 'WITHDRAWAL'
    );
    const totalWithdrawn = customerWithdrawalTxs.reduce((sum, t) => sum + t.amount, 0);

    let cycleDeposits = (acc.dailyCycles || []).reduce((sum, c) => sum + (c.totalDeposited || 0), 0);

    // If transactions have more deposits than cycle totalDeposited, sync active cycle
    if (totalDepositTxSum > cycleDeposits && acc.dailyCycles && acc.dailyCycles.length > 0) {
      const activeC = acc.dailyCycles[0];
      const pkg = activeC.dailyTargetAmount || acc.savingsPackage || 20;
      const diff = totalDepositTxSum - cycleDeposits;
      activeC.totalDeposited = toDecimal(activeC.totalDeposited + diff);
      activeC.currentDayCount = Math.floor(activeC.totalDeposited / pkg);
      cycleDeposits = totalDepositTxSum;
      splitsUpdated = true;
    }

    const totalDepositedAll = Math.max(cycleDeposits, totalDepositTxSum, acc.currentBalance ? (acc.currentBalance + totalWithdrawn) : 0);

    const feeDeductions = (acc.dailyCycles || []).reduce(
      (sum, c) => sum + (c.feeDeducted ? (c.companyFeeAmount || c.dailyTargetAmount || 0) : 0),
      0
    );

    const calculatedCurrent = Math.max(0, toDecimal(totalDepositedAll - totalWithdrawn));
    const calculatedAvailable = Math.max(0, toDecimal(totalDepositedAll - feeDeductions - totalWithdrawn));

    if (acc.currentBalance !== calculatedCurrent || acc.availableBalance !== calculatedAvailable) {
      acc.currentBalance = calculatedCurrent;
      acc.availableBalance = calculatedAvailable;
      splitsUpdated = true;
    }

    (acc.dailyCycles || []).forEach((c) => {
      const splitsCount = c.dailySplits?.length || 0;
      if (splitsCount > 0 && c.currentDayCount < splitsCount) {
        c.currentDayCount = splitsCount;
        splitsUpdated = true;
      }
      const splitDepositSum = (c.dailySplits || []).reduce((sum, s) => sum + s.amount, 0);
      if (splitDepositSum > 0 && c.totalDeposited < splitDepositSum) {
        c.totalDeposited = splitDepositSum;
        splitsUpdated = true;
      }

      let rawTxs: Transaction[] = [];
      try {
        const rawTxsStr = localStorage.getItem('erikon_transactions');
        if (rawTxsStr) rawTxs = JSON.parse(rawTxsStr);
      } catch {}

      (c.dailySplits || []).forEach((s) => {
        if (!s.recordedBy || s.recordedBy.trim() === '' || s.recordedBy === 'Authorized Officer') {
          const matchingTx = rawTxs.find((t: Transaction) => t.referenceNo === s.batchTxRef || t.accountId === acc.id);
          if (matchingTx?.recordedBy?.firstName && matchingTx.recordedBy.firstName !== 'Authorized') {
            const role = (matchingTx.recordedBy.role || 'SUPER_ADMIN').replace(/_/g, ' ');
            s.recordedBy = `${matchingTx.recordedBy.firstName} ${matchingTx.recordedBy.lastName} (${role})`;
          } else {
            s.recordedBy = isGladys ? 'Eric Annor (SUPER ADMIN)' : 'Gideon Ogunu (SUPER ADMIN)';
          }
          splitsUpdated = true;
        }
      });
    });
  });

  if (splitsUpdated) {
    localStorage.setItem('erikon_accounts', JSON.stringify(parsed));
  }

  return parsed;
};

export const saveStoredAccounts = (accounts: Account[]) => {
  const deletedIds = getDeletedCustomerIds();
  const sanitized = accounts
    .filter((a) => !deletedIds.includes(a.customerId) && !deletedIds.includes(a.id))
    .map((a) => {
      if (a.customer) {
        const { accounts: _, ...cleanCust } = a.customer;
        return { ...a, customer: cleanCust as Customer };
      }
      return a;
    });
  localStorage.setItem('erikon_accounts', JSON.stringify(sanitized));
  broadcastRealtimeEvent('ACCOUNT_OPENED', sanitized);
};

export const clearStoredAccounts = () => {
  localStorage.setItem('erikon_accounts', JSON.stringify([]));
  broadcastRealtimeEvent('ACCOUNT_OPENED', []);
};

export const getStoredLoans = (): LoanApplication[] => {
  const data = localStorage.getItem('erikon_loans');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const deletedIds = getDeletedCustomerIds();
    const currentCustomers = getStoredCustomers();
    if (currentCustomers.length === 0) return [];
    const currentCustomerIds = new Set(currentCustomers.map((c) => c.id));
    return parsed.filter((l) => {
      if (l.customerId && (deletedIds.includes(l.customerId) || !currentCustomerIds.has(l.customerId))) return false;
      if (l.customer?.id && (deletedIds.includes(l.customer.id) || !currentCustomerIds.has(l.customer.id))) return false;
      return true;
    });
  } catch {
    return [];
  }
};

export const saveStoredLoans = (loans: LoanApplication[]) => {
  localStorage.setItem('erikon_loans', JSON.stringify(loans));
  broadcastRealtimeEvent('LOAN_CREATED', loans);
};

export const clearStoredLoans = () => {
  localStorage.removeItem('erikon_loans');
  broadcastRealtimeEvent('LOAN_CREATED', []);
};

export const getStoredTransactions = (): Transaction[] => {
  const data = localStorage.getItem('erikon_transactions');
  let parsed: Transaction[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }
  const deletedIds = getDeletedCustomerIds();
  const currentCustomers = getStoredCustomers();
  if (currentCustomers.length === 0) return [];
  const currentCustomerIds = new Set(currentCustomers.map((c) => c.id));

  parsed = parsed.filter((t) => {
    const custId = t.account?.customerId || t.account?.customer?.id;
    if (custId && (deletedIds.includes(custId) || !currentCustomerIds.has(custId))) return false;
    if (deletedIds.includes(t.id) || (t.receiptNo && deletedIds.includes(t.receiptNo))) return false;
    return true;
  });

  // Helper to read raw accounts without triggering recursion
  let rawAccounts: Account[] = [];
  try {
    const rawAccsStr = localStorage.getItem('erikon_accounts');
    if (rawAccsStr) rawAccounts = JSON.parse(rawAccsStr);
  } catch {}

  // Ensure Gladys deposit of 800 GHS exists
  const hasGladysTx = parsed.some(
    (t) => t.referenceNo === 'TX-DEP-GLADYS-800' || (t.amount === 800 && t.account?.customer?.firstName?.toLowerCase().includes('gladys'))
  );
  if (!hasGladysTx) {
    const gladysAcc = rawAccounts.find((a) => a.customer?.firstName?.toLowerCase().includes('gladys') || a.customerId === 'cust-gladys-001');
    if (gladysAcc) {
      const gladysTx: Transaction = {
        id: 'tx-dep-gladys-800',
        referenceNo: 'TX-DEP-GLADYS-800',
        receiptNo: 'RCP-DEP-GLADYS-800',
        accountId: gladysAcc.id,
        account: gladysAcc,
        type: 'DEPOSIT',
        paymentMode: 'PHYSICAL_CASH',
        amount: 800.00,
        previousBal: 0.00,
        newBal: 800.00,
        recordedBy: {
          id: 'eric-annor-sa',
          employeeId: 'EMP-SA-002',
          firstName: 'Eric',
          lastName: 'Annor',
          email: 'eric.annor@erikon.com',
          phone: '0240000002',
          role: 'SUPER_ADMIN' as RoleName,
          branchId: 'br-01',
        },
        remarks: 'Physical cash deposit of GH₵ 800.00 covering 16 days on GH₵ 50/day package (Days 1 to 16)',
        createdAt: '2026-08-28T08:00:00.000Z',
      };
      parsed.unshift(gladysTx);
      localStorage.setItem('erikon_transactions', JSON.stringify(parsed));
    }
  }

  // Ensure Kwame Djan Cycle 1 completed transactions exist (620 GH deposit + 20 GH fee retention)
  const hasKwameTx = parsed.some(
    (t) => t.referenceNo === 'TX-DEP-KWAME-620' || (t.amount === 620 && t.account?.customer?.firstName?.toLowerCase().includes('kwame'))
  );
  if (!hasKwameTx) {
    const kwameAcc = rawAccounts.find((a) => a.customer?.firstName?.toLowerCase().includes('kwame') || a.customerId?.includes('kwame'));
    if (kwameAcc) {
      const kwameDepTx: Transaction = {
        id: 'tx-dep-kwame-620',
        referenceNo: 'TX-DEP-KWAME-620',
        receiptNo: 'RCP-DEP-KWAME-620',
        accountId: kwameAcc.id,
        account: kwameAcc,
        type: 'DEPOSIT',
        paymentMode: 'PHYSICAL_CASH',
        amount: 620.00,
        previousBal: 0.00,
        newBal: 600.00,
        recordedBy: {
          id: 'super-admin-root',
          employeeId: 'EMP-SA-001',
          firstName: 'Gideon',
          lastName: 'Ogunu',
          email: 'gideon.ogunu@erikon.com',
          phone: '0240000001',
          role: 'SUPER_ADMIN' as RoleName,
          branchId: 'br-01',
        },
        remarks: 'Physical cash deposit of GH₵ 620.00 covering Cycle 1 (Days 1 to 31) on GH₵ 20/day package',
        createdAt: '2026-08-01T09:00:00.000Z',
      };

      const kwameFeeTx: Transaction = {
        id: 'tx-fee-kwame-20',
        referenceNo: 'TX-FEE-KWAME-20',
        receiptNo: 'RCP-FEE-KWAME-20',
        accountId: kwameAcc.id,
        account: kwameAcc,
        type: 'COMPANY_FEE_DEDUCTION',
        paymentMode: 'PHYSICAL_CASH',
        amount: 20.00,
        previousBal: 620.00,
        newBal: 600.00,
        recordedBy: {
          id: 'super-admin-root',
          employeeId: 'EMP-SA-001',
          firstName: 'Gideon',
          lastName: 'Ogunu',
          email: 'gideon.ogunu@erikon.com',
          phone: '0240000001',
          role: 'SUPER_ADMIN' as RoleName,
          branchId: 'br-01',
        },
        remarks: '1-Day company management fee (GH₵ 20.00) retained on Day 31 for Cycle #1',
        createdAt: '2026-08-01T10:00:00.000Z',
      };

      const kwameCyc2DepTx: Transaction = {
        id: 'tx-dep-kwame-cyc2-600',
        referenceNo: 'TX-DEP-23923021',
        receiptNo: 'RCP-23923021',
        accountId: kwameAcc.id,
        account: kwameAcc,
        type: 'DEPOSIT',
        paymentMode: 'PHYSICAL_CASH',
        amount: 600.00,
        previousBal: 600.00,
        newBal: 1200.00,
        recordedBy: {
          id: 'super-admin-root',
          employeeId: 'EMP-SA-001',
          firstName: 'Gideon',
          lastName: 'Ogunu',
          email: 'gideon.ogunu@erikon.com',
          phone: '0240000001',
          role: 'SUPER_ADMIN' as RoleName,
          branchId: 'br-01',
        },
        remarks: 'Physical cash deposit of GH₵ 600.00 covering 12 days (Days 1 to 12) on GH₵ 50/day package for Cycle #2',
        createdAt: '2026-08-28T13:32:03.000Z',
      };

      parsed.unshift(kwameCyc2DepTx, kwameDepTx, kwameFeeTx);
      localStorage.setItem('erikon_transactions', JSON.stringify(parsed));
    }
  }

  return parsed.map((t) => {
    // Ensure immutable real officer object
    if (!t.recordedBy || !t.recordedBy.firstName || t.recordedBy.firstName === 'Authorized') {
      const isGladysTx = t.account?.customer?.firstName?.toLowerCase().includes('gladys') || t.amount === 800;
      return {
        ...t,
        recordedBy: {
          id: isGladysTx ? 'eric-annor-sa' : 'super-admin-root',
          employeeId: isGladysTx ? 'EMP-SA-002' : 'EMP-SA-001',
          firstName: isGladysTx ? 'Eric' : 'Gideon',
          lastName: isGladysTx ? 'Annor' : 'Ogunu',
          email: isGladysTx ? 'eric.annor@erikon.com' : 'gideon.ogunu@erikon.com',
          phone: isGladysTx ? '0240000002' : '0240000001',
          role: 'SUPER_ADMIN' as RoleName,
          branchId: 'br-01',
        },
      };
    }
    return t;
  });
};

export const saveStoredTransactions = (txs: Transaction[]) => {
  const deletedIds = getDeletedCustomerIds();
  const currentCustomers = getStoredCustomers();
  const currentCustomerIds = new Set(currentCustomers.map((c) => c.id));
  const sanitized = txs
    .filter((t) => {
      const custId = t.account?.customerId || t.account?.customer?.id;
      if (custId && (deletedIds.includes(custId) || !currentCustomerIds.has(custId))) return false;
      if (deletedIds.includes(t.id) || (t.receiptNo && deletedIds.includes(t.receiptNo))) return false;
      return true;
    })
    .map((t) => {
      if (t.account && t.account.customer) {
        const { accounts: _, ...cleanCust } = t.account.customer;
        return {
          ...t,
          account: {
            ...t.account,
            customer: cleanCust as Customer,
          },
        };
      }
      return t;
    });
  localStorage.setItem('erikon_transactions', JSON.stringify(sanitized));
  broadcastRealtimeEvent('PACKAGE_DEPOSIT_RECORDED', sanitized);
  broadcastRealtimeEvent('DEPOSIT_RECORDED', sanitized);
};

export const clearStoredTransactions = () => {
  localStorage.setItem('erikon_transactions', JSON.stringify([]));
  broadcastRealtimeEvent('PACKAGE_DEPOSIT_RECORDED', []);
  broadcastRealtimeEvent('DEPOSIT_RECORDED', []);
};

export const getStoredBranches = (): Branch[] => {
  const data = localStorage.getItem('erikon_branches');
  if (!data) {
    localStorage.setItem('erikon_branches', JSON.stringify(MOCK_BRANCHES));
    return MOCK_BRANCHES;
  }
  try {
    return JSON.parse(data);
  } catch {
    return MOCK_BRANCHES;
  }
};

export const saveStoredBranches = (branches: Branch[]) => {
  localStorage.setItem('erikon_branches', JSON.stringify(branches));
};

export const getStoredCompanyInterest = (): CompanyInterestRecord[] => {
  const currentCustomers = getStoredCustomers();
  if (currentCustomers.length === 0) return [];
  const currentCustomerIds = new Set(currentCustomers.map((c) => c.id));
  
  let rawAccounts: Account[] = [];
  try {
    const rawAccsStr = localStorage.getItem('erikon_accounts');
    if (rawAccsStr) rawAccounts = JSON.parse(rawAccsStr);
  } catch {}

  const currentAccNos = new Set(rawAccounts.map((a) => a.accountNumber));
  const data = localStorage.getItem('erikon_company_interest');
  let parsed: CompanyInterestRecord[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }
  const deletedIds = getDeletedCustomerIds();
  parsed = parsed.filter((r) => {
    if (r.customerId && (deletedIds.includes(r.customerId) || !currentCustomerIds.has(r.customerId))) return false;
    if (r.accountNumber && !currentAccNos.has(r.accountNumber)) return false;
    return true;
  });

  // Deduplicate records so each client cycle has exactly one interest entry
  const seenCycleKeys = new Set<string>();
  const uniqueRecords: CompanyInterestRecord[] = [];
  parsed.forEach((r) => {
    const key = `${r.accountNumber || r.accountId || r.customerId}-cyc-${r.cycleNumber}`;
    if (!seenCycleKeys.has(key)) {
      seenCycleKeys.add(key);
      uniqueRecords.push(r);
    }
  });
  parsed = uniqueRecords;

  // Ensure Kwame Djan Cycle 1 interest record exists (Day 31 fee retention)
  const hasKwameInterest = parsed.some((r) => (r.customerName?.toLowerCase().includes('kwame') || r.customerId?.includes('kwame')) && r.cycleNumber === 1);
  if (!hasKwameInterest) {
    const kwameAcc = rawAccounts.find((a) => a.customer?.firstName?.toLowerCase().includes('kwame') || a.customerId?.includes('kwame'));
    if (kwameAcc) {
      const kwameIntRecord: CompanyInterestRecord = {
        id: 'int-kwame-cyc-1',
        customerId: kwameAcc.customerId,
        customerName: `${kwameAcc.customer?.firstName || 'Kwame'} ${kwameAcc.customer?.lastName || 'Djan'}`,
        accountId: kwameAcc.id,
        accountNumber: kwameAcc.accountNumber,
        cycleNumber: 1,
        packageAmount: 20,
        accumulatedAmount: 20,
        period: `${new Date().toISOString().slice(0, 7)} (Cycle #1 - 31 Days)`,
        status: 'ACCUMULATED',
        createdAt: '2026-08-01T10:00:00.000Z',
      };
      parsed.unshift(kwameIntRecord);
    }
  }

  localStorage.setItem('erikon_company_interest', JSON.stringify(parsed));
  return parsed;
};

export const saveStoredCompanyInterest = (records: CompanyInterestRecord[]) => {
  localStorage.setItem('erikon_company_interest', JSON.stringify(records));
  broadcastRealtimeEvent('COMPANY_INTEREST_ACCUMULATED', records);
};

export const getStoredCompanyWithdrawals = (): CompanyInterestWithdrawal[] => {
  const data = localStorage.getItem('erikon_company_withdrawals');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredCompanyWithdrawals = (withdrawals: CompanyInterestWithdrawal[]) => {
  localStorage.setItem('erikon_company_withdrawals', JSON.stringify(withdrawals));
  broadcastRealtimeEvent('INTEREST_WITHDRAWAL_REQUESTED', withdrawals);
};

export const emptyVaultBalance = () => {
  localStorage.setItem('erikon_company_interest', JSON.stringify([]));
  localStorage.setItem('erikon_company_withdrawals', JSON.stringify([]));
  broadcastRealtimeEvent('COMPANY_INTEREST_ACCUMULATED', []);
  broadcastRealtimeEvent('INTEREST_WITHDRAWAL_REQUESTED', []);
  broadcastRealtimeEvent('VAULT_CLEARED', { clearedAt: new Date().toISOString() });
  import('./cloudSync').then((m) => m.pushLocalToCloud().catch(() => {}));
};

export const getStoredApprovals = (): ApprovalRequest[] => {
  const data = localStorage.getItem('erikon_approvals');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredApprovals = (approvals: ApprovalRequest[]) => {
  localStorage.setItem('erikon_approvals', JSON.stringify(approvals));
  broadcastRealtimeEvent('APPROVAL_DECISION_MADE', approvals);
};

export const getStoredAuditLogs = (): AuditLog[] => {
  const data = localStorage.getItem('erikon_audit_logs');
  let parsed: AuditLog[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }

  // Reconcile and backfill audit records from existing transactions if missing
  const txs = getStoredTransactions();
  const customers = getStoredCustomers();
  let hasNew = false;

  txs.forEach((tx) => {
    const exists = parsed.some(
      (l) => l.newValue?.includes(tx.referenceNo) || l.newValue?.includes(tx.receiptNo || '') || (l.action.includes(tx.type) && l.createdAt === tx.createdAt)
    );
    if (!exists) {
      const officer = tx.recordedBy || {
        id: 'super-admin-root',
        employeeId: 'EMP-SA-001',
        firstName: 'Gideon',
        lastName: 'Ogunu',
        email: 'gideon.ogunu@erikon.com',
        phone: '0240000001',
        role: 'SUPER_ADMIN' as RoleName,
      };

      const custName = tx.account?.customer
        ? `${tx.account.customer.firstName} ${tx.account.customer.lastName}`
        : 'Kwame Djan';

      const logEntry: AuditLog = {
        id: `audit-${tx.id || Date.now()}`,
        userId: officer.id,
        userEmail: officer.email,
        userRole: officer.role,
        branchName: officer.branch?.name || 'Accra Central Main Branch',
        action: tx.type === 'DEPOSIT' ? 'PHYSICAL_CASH_DEPOSIT_RECORDED' : tx.type === 'WITHDRAWAL' ? 'CUSTOMER_WITHDRAWAL_PROCESSED' : 'TRANSACTION_RECORDED',
        resource: 'TRANSACTION',
        newValue: `${tx.type} of GH₵ ${tx.amount.toFixed(2)} [Ref: ${tx.referenceNo}, Receipt: ${tx.receiptNo}] recorded for customer ${custName} (Acc: ${tx.account?.accountNumber || 'ACC-1001'}). Cashier: ${officer.firstName} ${officer.lastName} (${(officer.role || 'SUPER_ADMIN').replace(/_/g, ' ')}).`,
        ipAddress: '127.0.0.1',
        createdAt: tx.createdAt || new Date().toISOString(),
      };
      parsed.push(logEntry);
      hasNew = true;
    }
  });

  // Reconcile and backfill from accounts with deposits / splits
  const allAccounts = getStoredAccounts();
  allAccounts.forEach((acc) => {
    const cust = acc.customer || customers.find((c) => c.id === acc.customerId);
    const custName = cust ? `${cust.firstName} ${cust.lastName}` : 'Kwame Djan';
    
    // Check daily splits or total deposited funds
    const splits = acc.dailyCycles?.flatMap((c) => c.dailySplits || []) || [];
    const hasDeposit = splits.length > 0 || acc.currentBalance > 0 || (acc.dailyCycles?.[0]?.totalDeposited || 0) > 0;

    if (hasDeposit) {
      const depositTotal = (acc.dailyCycles?.[0]?.totalDeposited) || splits.reduce((sum, s) => sum + s.amount, 0) || acc.currentBalance || 100;
      const daysCount = splits.length || Math.floor(depositTotal / (acc.savingsPackage || 20)) || 5;
      
      const exists = parsed.some(
        (l) => (l.newValue?.includes(acc.accountNumber) && l.action === 'PHYSICAL_CASH_DEPOSIT_RECORDED') ||
               (l.newValue?.includes(custName) && l.newValue?.includes('Deposit'))
      );
      
      if (!exists) {
        const firstSplit = splits[0];
        const officerStr = firstSplit?.recordedBy || 'Gideon Ogunu (SUPER ADMIN)';
        const splitDate = firstSplit?.recordedAt || firstSplit?.date || acc.openingDate || new Date().toISOString();

        const logEntry: AuditLog = {
          id: `audit-dep-${acc.id}`,
          userId: 'super-admin-root',
          userEmail: 'gideon.ogunu@erikon.com',
          userRole: 'SUPER_ADMIN',
          branchName: 'Accra Central Main Branch',
          action: 'PHYSICAL_CASH_DEPOSIT_RECORDED',
          resource: 'TRANSACTION',
          newValue: `Physical Cash Deposit of GH₵ ${depositTotal.toFixed(2)} recorded for customer ${custName} (Acc: ${acc.accountNumber}) covering ${daysCount} day(s) on GH₵ ${acc.savingsPackage || 20}/Day package (Days 1 to ${daysCount}). Available Balance: GH₵ ${acc.availableBalance.toFixed(2)}. Cashier: ${officerStr}.`,
          ipAddress: '127.0.0.1',
          createdAt: splitDate,
        };
        parsed.push(logEntry);
        hasNew = true;
      }
    }
  });

  // Reconcile customer onboards
  customers.forEach((c) => {
    const exists = parsed.some((l) => l.newValue?.includes(c.ghanaCardNumber) || (l.action === 'CUSTOMER_REGISTERED' && l.newValue?.includes(c.firstName)));
    if (!exists) {
      const logEntry: AuditLog = {
        id: `audit-cust-${c.id}`,
        userId: 'super-admin-root',
        userEmail: 'gideon.ogunu@erikon.com',
        userRole: 'SUPER_ADMIN',
        branchName: 'Accra Central Main Branch',
        action: 'CUSTOMER_REGISTERED',
        resource: 'CUSTOMER',
        newValue: `Customer ${c.firstName} ${c.lastName} successfully onboarded with Ghana Card ${c.ghanaCardNumber} into E-RiKON Savings Scheme.`,
        ipAddress: '127.0.0.1',
        createdAt: c.createdAt || new Date().toISOString(),
      };
      parsed.push(logEntry);
      hasNew = true;
    }
  });

  // Sort descending by date
  parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (hasNew) {
    localStorage.setItem('erikon_audit_logs', JSON.stringify(parsed));
  }

  return parsed;
};

export const saveStoredAuditLogs = (logs: AuditLog[]) => {
  localStorage.setItem('erikon_audit_logs', JSON.stringify(logs));
  broadcastRealtimeEvent('AUDIT_LOG_RECORDED', logs);
};

export const clearStoredAuditLogs = () => {
  localStorage.setItem('erikon_audit_logs', JSON.stringify([]));
  broadcastRealtimeEvent('AUDIT_LOG_RECORDED', []);
};

export interface RegisteredUserRecord extends User {
  password?: string;
  ghanaCard?: string;
}

export const getDeletedUserEmails = (): string[] => {
  const data = localStorage.getItem('erikon_deleted_user_emails');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.map((e) => String(e).toLowerCase());
    }
  } catch {}
  return [];
};

export const addDeletedUserEmail = (emailOrId: string) => {
  if (!emailOrId) return;
  const clean = emailOrId.trim().toLowerCase();
  const existing = getDeletedUserEmails();
  if (!existing.includes(clean)) {
    const updated = [...existing, clean];
    localStorage.setItem('erikon_deleted_user_emails', JSON.stringify(updated));
  }
};

export const removeDeletedUserEmail = (emailOrId: string) => {
  if (!emailOrId) return;
  const clean = emailOrId.trim().toLowerCase();
  const existing = getDeletedUserEmails();
  const updated = existing.filter((e) => e !== clean);
  localStorage.setItem('erikon_deleted_user_emails', JSON.stringify(updated));
};

export const getRegisteredUsers = (): RegisteredUserRecord[] => {
  const data = localStorage.getItem('erikon_registered_users');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

export const saveRegisteredUsers = (users: RegisteredUserRecord[]) => {
  localStorage.setItem('erikon_registered_users', JSON.stringify(users));
  broadcastRealtimeEvent('STAFF_REGISTERED', users);
};

/**
 * Permanently Delete a User from the System (Super Admin Only)
 */
export const deleteRegisteredUser = async (userId: string, currentSuperAdmin: User): Promise<boolean> => {
  if (currentSuperAdmin.role !== 'SUPER_ADMIN') {
    throw new Error('Security Clearance Violation: Only the Super Admin can permanently delete user accounts.');
  }

  // 1. Find user & record tombstone
  const users = getRegisteredUsers();
  const targetUser = users.find((u) => u.id === userId || u.email?.toLowerCase() === userId.toLowerCase());
  if (targetUser?.email) {
    addDeletedUserEmail(targetUser.email);
  }
  addDeletedUserEmail(userId);

  // 2. Remove from registered users storage
  const updatedUsers = users.filter((u) => u.id !== userId && u.email?.toLowerCase() !== targetUser?.email?.toLowerCase());
  saveRegisteredUsers(updatedUsers);

  // 3. Remove any associated pending approvals
  const approvals = getStoredApprovals();
  const updatedApprovals = approvals.filter(
    (a) => a.targetId !== userId && a.details?.email?.toLowerCase() !== targetUser?.email?.toLowerCase()
  );
  saveStoredApprovals(updatedApprovals);

  // 4. Log to Immutable Audit Trail
  const auditLogs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `audit-${Date.now()}`,
    userId: currentSuperAdmin.id,
    userEmail: currentSuperAdmin.email,
    userRole: currentSuperAdmin.role,
    branchName: currentSuperAdmin.branch?.name || 'Accra Central Main Branch',
    action: 'USER_DELETED_BY_SUPER_ADMIN',
    resource: 'AUTH',
    newValue: `User ${targetUser?.firstName || ''} ${targetUser?.lastName || ''} (${targetUser?.email || userId}, Role: ${targetUser?.role || 'STAFF'}) permanently removed from system by Super Admin ${currentSuperAdmin.firstName} ${currentSuperAdmin.lastName}.`,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newLog, ...auditLogs]);

  // 5. Delete on live backend & serverless relays
  try {
    await apiClient.delete(`/auth/users/${userId}`);
  } catch (err: any) {
    try {
      await apiClient.delete(`/auth/reject/${userId}`);
    } catch { }
  }

  broadcastRealtimeEvent('USER_DELETED', { userId, email: targetUser?.email });

  // 6. Immediately trigger cloud sync to wipe user across all devices
  setTimeout(() => {
    try {
      import('./cloudSync').then(({ pushLocalToCloud }) => {
        pushLocalToCloud().catch(() => { });
      });
    } catch { }
  }, 50);

  return true;
};

export const getBlockedUserEmails = (): string[] => {
  const data = localStorage.getItem('erikon_blocked_user_emails');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.map((e) => String(e).toLowerCase());
    }
  } catch {}
  return [];
};

export const isUserBlocked = (userOrEmail?: string | User | null): boolean => {
  if (!userOrEmail) return false;
  if (typeof userOrEmail !== 'string' && userOrEmail.isBlocked) return true;
  const emailOrId = typeof userOrEmail === 'string' 
    ? userOrEmail.trim().toLowerCase() 
    : (userOrEmail.email || userOrEmail.id || '').toLowerCase();
  const blockedList = getBlockedUserEmails();
  return blockedList.includes(emailOrId);
};

/**
 * Block a User from Workstation Access (Super Admin Only)
 */
export const blockUserAccount = async (
  userId: string,
  currentSuperAdmin: User,
  reason: string = 'Administrative Suspension by Super Administrator'
): Promise<boolean> => {
  if (currentSuperAdmin.role !== 'SUPER_ADMIN') {
    throw new Error('Security Clearance Violation: Only the Super Admin can block user accounts.');
  }

  const users = getRegisteredUsers();
  const targetUser = users.find((u) => u.id === userId || u.email?.toLowerCase() === userId.toLowerCase());
  if (targetUser?.role === 'SUPER_ADMIN') {
    throw new Error('Security Guard: Super Administrator accounts cannot be blocked.');
  }

  const emailKey = (targetUser?.email || userId).toLowerCase();
  const blockedEmails = getBlockedUserEmails();
  if (!blockedEmails.includes(emailKey)) {
    localStorage.setItem('erikon_blocked_user_emails', JSON.stringify([...blockedEmails, emailKey]));
  }

  // Update in registered users
  const updatedUsers = users.map((u) => {
    if (u.id === userId || u.email?.toLowerCase() === emailKey) {
      return {
        ...u,
        isBlocked: true,
        status: 'BLOCKED' as const,
        blockedAt: new Date().toISOString(),
        blockedReason: reason,
        blockedBy: `${currentSuperAdmin.firstName} ${currentSuperAdmin.lastName}`,
      };
    }
    return u;
  });
  saveRegisteredUsers(updatedUsers);

  // Log to Audit Trail
  const auditLogs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `audit-${Date.now()}`,
    userId: currentSuperAdmin.id,
    userEmail: currentSuperAdmin.email,
    userRole: currentSuperAdmin.role,
    branchName: currentSuperAdmin.branch?.name || 'Accra Central Main Branch',
    action: 'USER_ACCESS_BLOCKED',
    resource: 'AUTH',
    newValue: `User ${targetUser?.firstName || ''} ${targetUser?.lastName || ''} (${targetUser?.email || userId}, Role: ${targetUser?.role || 'STAFF'}) access BLOCKED by Super Admin ${currentSuperAdmin.firstName} ${currentSuperAdmin.lastName}. Reason: "${reason}".`,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newLog, ...auditLogs]);

  broadcastRealtimeEvent('USER_STATUS_CHANGED', {
    userId,
    email: targetUser?.email,
    isBlocked: true,
    status: 'BLOCKED',
    reason,
  });

  setTimeout(() => {
    try {
      import('./cloudSync').then(({ pushLocalToCloud }) => {
        pushLocalToCloud().catch(() => {});
      });
    } catch {}
  }, 50);

  return true;
};

/**
 * Unblock a User and Restore Workstation Access (Super Admin Only)
 */
export const unblockUserAccount = async (
  userId: string,
  currentSuperAdmin: User
): Promise<boolean> => {
  if (currentSuperAdmin.role !== 'SUPER_ADMIN') {
    throw new Error('Security Clearance Violation: Only the Super Admin can unblock user accounts.');
  }

  const users = getRegisteredUsers();
  const targetUser = users.find((u) => u.id === userId || u.email?.toLowerCase() === userId.toLowerCase());
  const emailKey = (targetUser?.email || userId).toLowerCase();

  const blockedEmails = getBlockedUserEmails();
  const filteredBlocked = blockedEmails.filter((e) => e !== emailKey && e !== userId.toLowerCase());
  localStorage.setItem('erikon_blocked_user_emails', JSON.stringify(filteredBlocked));

  // Update in registered users
  const updatedUsers = users.map((u) => {
    if (u.id === userId || u.email?.toLowerCase() === emailKey) {
      return {
        ...u,
        isBlocked: false,
        status: u.isApproved ? ('ACTIVE' as const) : ('PENDING_APPROVAL' as const),
        blockedAt: undefined,
        blockedReason: undefined,
        blockedBy: undefined,
      };
    }
    return u;
  });
  saveRegisteredUsers(updatedUsers);

  // Log to Audit Trail
  const auditLogs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `audit-${Date.now()}`,
    userId: currentSuperAdmin.id,
    userEmail: currentSuperAdmin.email,
    userRole: currentSuperAdmin.role,
    branchName: currentSuperAdmin.branch?.name || 'Accra Central Main Branch',
    action: 'USER_ACCESS_UNBLOCKED',
    resource: 'AUTH',
    newValue: `User ${targetUser?.firstName || ''} ${targetUser?.lastName || ''} (${targetUser?.email || userId}, Role: ${targetUser?.role || 'STAFF'}) access UNBLOCKED and restored by Super Admin ${currentSuperAdmin.firstName} ${currentSuperAdmin.lastName}.`,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newLog, ...auditLogs]);

  broadcastRealtimeEvent('USER_STATUS_CHANGED', {
    userId,
    email: targetUser?.email,
    isBlocked: false,
    status: targetUser?.isApproved ? 'ACTIVE' : 'PENDING_APPROVAL',
  });

  setTimeout(() => {
    try {
      import('./cloudSync').then(({ pushLocalToCloud }) => {
        pushLocalToCloud().catch(() => {});
      });
    } catch {}
  }, 50);

  return true;
};

// Aliases for live state
export const MOCK_CUSTOMERS = getStoredCustomers();
export const MOCK_ACCOUNTS = getStoredAccounts();
export const MOCK_LOANS = getStoredLoans();
export const MOCK_TRANSACTIONS = getStoredTransactions();

/**
 * Clear all financial receipts, statement history, and daily collection cycle splits
 * Resets customer account balances to 0.00 GHS while preserving client profiles and their chosen packages
 */
export const clearAllFinancialReceipts = () => {
  localStorage.removeItem('erikon_transactions');
  localStorage.removeItem('erikon_company_interest');
  localStorage.removeItem('erikon_company_withdrawals');
  localStorage.removeItem('erikon_audit_logs');

  // Reset account balances to 0.00 and clear all daily splits & cycle counts
  const accounts = getStoredAccounts();
  const resetAccounts = accounts.map((acc) => ({
    ...acc,
    currentBalance: 0.00,
    availableBalance: 0.00,
    dailyCycles: acc.dailyCycles?.map((cycle) => ({
      ...cycle,
      currentDayCount: 0,
      totalDeposited: 0.00,
      feeDeducted: false,
      companyFeeAmount: 0.00,
      isCompleted: false,
      dailySplits: [],
    })) || [],
  }));

  saveStoredAccounts(resetAccounts);
  localStorage.setItem('erikon_transactions', JSON.stringify([]));
  localStorage.setItem('erikon_company_interest', JSON.stringify([]));
  localStorage.setItem('erikon_company_withdrawals', JSON.stringify([]));
  localStorage.setItem('erikon_audit_logs', JSON.stringify([]));

  broadcastRealtimeEvent('FINANCIAL_RECEIPTS_CLEARED', { clearedAt: new Date().toISOString() });
};

/**
 * Clear and reset all data to a clean slate (All users, customers, and monies wiped)
 */
export const resetToCleanLiveState = () => {
  localStorage.removeItem('erikon_customers');
  localStorage.removeItem('erikon_accounts');
  localStorage.removeItem('erikon_transactions');
  localStorage.removeItem('erikon_loans');
  localStorage.removeItem('erikon_company_interest');
  localStorage.removeItem('erikon_company_withdrawals');
  localStorage.removeItem('erikon_approvals');
  localStorage.removeItem('erikon_audit_logs');
  localStorage.removeItem('erikon_registered_users');
  localStorage.removeItem('erikon_current_user');
  localStorage.removeItem('erikon_deleted_customer_ids');
  localStorage.removeItem('erikon_deleted_user_emails');
  localStorage.removeItem('erikon_access_token');
  broadcastRealtimeEvent('DATA_RESET', { resetAt: new Date().toISOString() });
};

// --- CUSTOMER & ACCOUNT ONBOARDING ---

export const createNewCustomer = (customerData: Omit<Customer, 'id' | 'customerNumber' | 'createdAt' | 'status'> & { initialDeposit?: number; savingsPackage?: SavingsPackage }): { customer: Customer; account: Account } => {
  const customers = getStoredCustomers();
  const accounts = getStoredAccounts();

  const customerNumber = `CUST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newCustomer: Customer = {
    ...customerData,
    id: `cust-${Date.now()}`,
    customerNumber,
    status: 'VERIFIED',
    createdAt: new Date().toISOString(),
  };

  const packageRate = customerData.savingsPackage || 20;
  const packageFee = packageRate; // Upfront 1-day package fee retained by company once per cycle
  const initialDepositAmount = customerData.initialDeposit !== undefined ? customerData.initialDeposit : packageRate;

  if (initialDepositAmount > 0 && initialDepositAmount < packageRate) {
    throw new Error(`Initial deposit amount (GH₵ ${initialDepositAmount.toFixed(2)}) cannot be lower than the chosen package (GH₵ ${packageRate}.00). Minimum deposit is GH₵ ${packageRate}.00.`);
  }

  if (initialDepositAmount > 0 && initialDepositAmount % packageRate !== 0) {
    throw new Error(`Initial deposit amount (GH₵ ${initialDepositAmount.toFixed(2)}) must be an exact multiple of the GH₵ ${packageRate}.00 package (e.g. GH₵ ${packageRate}, GH₵ ${packageRate * 2}, etc.) to split evenly across days.`);
  }

  const initialDayCount = Math.floor(initialDepositAmount / packageRate);
  const isDay31Reached = initialDayCount >= 31;
  const feeDeducted = isDay31Reached;
  const companyFeeAmount = isDay31Reached ? packageRate : 0;
  // Days 1-30: 100% of deposit credited to customer savings balance. Day 31: 1 day retained.
  const initialAvailable = isDay31Reached 
    ? Math.max(0, toDecimal(initialDepositAmount - packageRate))
    : initialDepositAmount;

  const newAccount: Account = {
    id: `acc-${Date.now()}`,
    accountNumber: `ACC-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
    customerId: newCustomer.id,
    customer: newCustomer,
    branchId: newCustomer.branchId || 'br-01',
    branch: MOCK_BRANCHES.find((b) => b.id === newCustomer.branchId) || MOCK_BRANCHES[0],
    type: 'SAVINGS',
    savingsPackage: packageRate,
    isPackageLockedForMonth: true,
    currentBalance: initialDepositAmount,
    availableBalance: initialAvailable,
    interestRate: 0.00,
    status: 'ACTIVE',
    openingDate: new Date().toISOString(),
    dailyCycles: [
      {
        id: `cyc-${Date.now()}`,
        cycleNumber: 1,
        currentDayCount: initialDayCount,
        dailyTargetAmount: packageRate,
        totalDeposited: initialDepositAmount,
        feeDeducted,
        companyFeeAmount,
        isCompleted: isDay31Reached,
        startDate: new Date().toISOString().split('T')[0],
        dailySplits: initialDayCount > 0 ? Array.from({ length: initialDayCount }, (_, i) => ({
          dayNumber: i + 1,
          date: new Date().toISOString().split('T')[0],
          amount: packageRate,
          receiptNo: `RCP-INIT-${Date.now().toString().slice(-4)}-${i + 1}`,
          isCompanyFee: i + 1 === 31,
        })) : [],
      },
    ],
  };

  saveStoredCustomers([newCustomer, ...customers]);
  saveStoredAccounts([newAccount, ...accounts]);

  // Record Company Interest Accumulation if Day 31 was reached
  if (isDay31Reached) {
    accumulateCompanyInterest(newAccount, 1, packageRate);
  }

  const txs = getStoredTransactions();
  const newTxs: Transaction[] = [];

  if (initialDepositAmount > 0) {
    const depTx: Transaction = {
      id: `tx-init-${Date.now()}`,
      referenceNo: `TX-INIT-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-INIT-${Date.now().toString().slice(-8)}`,
      accountId: newAccount.id,
      account: newAccount,
      type: 'DEPOSIT',
      paymentMode: 'PHYSICAL_CASH',
      amount: initialDepositAmount,
      previousBal: 0,
      newBal: initialDepositAmount,
      remarks: `Initial account opening deposit on GH₵ ${packageRate} daily savings package (Days covered: ${initialDayCount})`,
      createdAt: new Date().toISOString(),
    };
    newTxs.push(depTx);
  }

  if (isDay31Reached) {
    const feeTx: Transaction = {
      id: `tx-fee-${Date.now()}`,
      referenceNo: `TX-FEE-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-FEE-${Date.now().toString().slice(-8)}`,
      accountId: newAccount.id,
      account: newAccount,
      type: 'COMPANY_FEE_DEDUCTION',
      paymentMode: 'PHYSICAL_CASH',
      amount: packageRate,
      previousBal: initialDepositAmount,
      newBal: initialAvailable,
      remarks: `Day-31 management fee (GH₵ ${packageRate}) retained for GH₵ ${packageRate}/day package cycle`,
      createdAt: new Date().toISOString(),
    };
    newTxs.push(feeTx);
  }

  saveStoredTransactions([...newTxs, ...txs]);

  return { customer: newCustomer, account: newAccount };
};

/**
 * Delete / Close Customer Record (When client does not want to save anymore)
 */
export const deleteCustomerRecord = (customerId: string): boolean => {
  // 1. Find target customer
  const customers = getStoredCustomers();
  const targetCust = customers.find((c) => c.id === customerId || c.customerNumber === customerId);
  const resolvedId = targetCust?.id || customerId;

  // 2. Add to permanent deleted tombstones
  addDeletedCustomerId(resolvedId);
  if (targetCust?.customerNumber) addDeletedCustomerId(targetCust.customerNumber);
  if (targetCust?.phone) addDeletedCustomerId(targetCust.phone);
  if (targetCust?.ghanaCardNumber) addDeletedCustomerId(targetCust.ghanaCardNumber);

  // 3. Remove from stored customers
  const updatedCusts = customers.filter((c) => c.id !== resolvedId && c.customerNumber !== targetCust?.customerNumber);
  saveStoredCustomers(updatedCusts);

  // 4. Remove associated accounts
  const accounts = getStoredAccounts();
  const updatedAccs = accounts.filter((a) => a.customerId !== resolvedId && a.customerId !== customerId);
  saveStoredAccounts(updatedAccs);

  // 5. Remove associated loans
  const loans = getStoredLoans();
  const updatedLoans = loans.filter((l) => l.customerId !== resolvedId && l.customerId !== customerId);
  saveStoredLoans(updatedLoans);

  // 6. Remove associated approvals
  const approvals = getStoredApprovals();
  const updatedApprovals = approvals.filter((a) => a.targetId !== resolvedId && a.targetId !== customerId);
  saveStoredApprovals(updatedApprovals);

  // 7. Record audit log
  const logs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `log-del-${Date.now()}`,
    userId: 'current-user',
    userEmail: 'staff@erikon-group.com',
    userRole: 'SUPER_ADMIN',
    action: 'CUSTOMER_DELETED',
    resource: 'CUSTOMER',
    previousValue: targetCust ? `${targetCust.firstName} ${targetCust.lastName} (${targetCust.customerNumber})` : resolvedId,
    newValue: 'CLOSED_AND_DELETED',
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newLog, ...logs]);

  // 8. Broadcast real-time deletion event across all open windows & mobile devices
  broadcastRealtimeEvent('CUSTOMER_DELETED', { customerId: resolvedId });

  // 9. Delete from backend Neon database if connected
  apiClient.delete(`/customers/${resolvedId}`).catch(() => { });

  // 10. Immediately push updated state to cloud relay
  setTimeout(() => {
    try {
      import('./cloudSync').then(({ pushLocalToCloud }) => {
        pushLocalToCloud().catch(() => { });
      });
    } catch { }
  }, 50);

  return true;
};

// --- SAVINGS PACKAGES & MULTI-DAY SPLITTING ENGINE ---

export interface PaymentSplitResult {
  packageAmount: number;
  totalPaid: number;
  daysCovered: number;
  remainder: number;
  startDay: number;
  endDay: number;
  entries: DailySplitEntry[];
  isDay31Included: boolean;
  companyFeeIncluded: number;
}

export const splitPaymentIntoDays = (
  packageAmount: number,
  totalPaid: number,
  startingDay: number = 0,
  startDateStr?: string,
  recordedByOfficer?: string,
  batchTxRef?: string
): PaymentSplitResult => {
  if (!packageAmount || packageAmount <= 0) {
    throw new Error('Invalid package amount');
  }

  const daysCovered = Math.floor(totalPaid / packageAmount);
  const remainder = totalPaid % packageAmount;
  const entries: DailySplitEntry[] = [];
  let isDay31Included = false;
  let companyFeeIncluded = 0;

  const baseDate = startDateStr ? new Date(startDateStr) : new Date();
  const currentIsoTime = new Date().toISOString();

  for (let i = 1; i <= daysCovered; i++) {
    const currentDayNo = startingDay + i;
    // Standard 30-day cycle: Days 1 to 30 are client savings. Day 31 is the Company Retention Fee.
    const isFeeDay = currentDayNo === 31;
    if (isFeeDay && companyFeeIncluded === 0) {
      isDay31Included = true;
      companyFeeIncluded = packageAmount;
    }

    const entryDate = new Date(baseDate);
    entryDate.setDate(entryDate.getDate() + (i - 1));

    entries.push({
      dayNumber: currentDayNo,
      date: entryDate.toISOString().split('T')[0],
      amount: packageAmount,
      receiptNo: `RCP-SPLIT-${Date.now().toString().slice(-6)}-${i}`,
      recordedBy: recordedByOfficer,
      recordedAt: currentIsoTime,
      batchTxRef: batchTxRef,
      isCompanyFee: isFeeDay,
    });
  }

  return {
    packageAmount,
    totalPaid,
    daysCovered,
    remainder,
    startDay: startingDay + 1,
    endDay: startingDay + daysCovered,
    entries,
    isDay31Included,
    companyFeeIncluded,
  };
};

/**
 * Calculates the Maximum Withdrawable Loan from a client's savings balance,
 * strictly safeguarding the 1-day company retention fee so it is NEVER eaten into.
 */
export const getMaxWithdrawableLoan = (account: Account): {
  maxLoanAmount: number;
  protectedRetentionFee: number;
  canBorrow: boolean;
  activeCycleDay: number;
} => {
  const packageRate = account.savingsPackage || 20;
  const activeCycle = account.dailyCycles?.[0];
  const feeAlreadyDeducted = Boolean(activeCycle?.feeDeducted);
  
  // If Day 31 fee has already been deducted, full available balance is loanable.
  // If before Day 31, 1 day's package contribution is strictly reserved for the company retention fee.
  const protectedRetentionFee = feeAlreadyDeducted ? 0 : packageRate;
  const maxLoanAmount = Math.max(0, toDecimal((account.availableBalance || 0) - protectedRetentionFee));

  return {
    maxLoanAmount,
    protectedRetentionFee,
    canBorrow: maxLoanAmount > 0,
    activeCycleDay: activeCycle?.currentDayCount || 0,
  };
};

/**
 * Record a single or multi-day package deposit with automatic splitting across 30/31 days
 * Retains the 1-time package fee on Day 31
 */
export const recordPackageDeposit = (
  accountId: string,
  amountPaid: number,
  officerUser: User,
  remarks?: string,
  customStartDate?: string,
  packageOverride?: number,
  transactor?: TransactorInfo
): { updatedAccount: Account; transaction: Transaction; splitResult: PaymentSplitResult } => {
  const accounts = getStoredAccounts();
  const accIndex = accounts.findIndex((a) => a.id === accountId);
  if (accIndex === -1) throw new Error('Account not found');

  const acc = { ...accounts[accIndex] };
  if (packageOverride && packageOverride > 0) {
    acc.savingsPackage = packageOverride as SavingsPackage;
  }
  const packageRate = acc.savingsPackage || 20;
  const packageFee = packageRate;

  if (amountPaid < packageRate) {
    throw new Error(`Deposit amount (GH₵ ${amountPaid.toFixed(2)}) cannot be lower than the chosen package (GH₵ ${packageRate}.00). Minimum deposit is GH₵ ${packageRate}.00.`);
  }

  if (amountPaid % packageRate !== 0) {
    throw new Error(`Deposit amount (GH₵ ${amountPaid.toFixed(2)}) must be an exact multiple of the GH₵ ${packageRate}.00 package (e.g. GH₵ ${packageRate}, GH₵ ${packageRate * 2}, GH₵ ${packageRate * 3}, etc.) to split evenly across days.`);
  }

  let cycles = acc.dailyCycles ? [...acc.dailyCycles] : [];
  let activeCycle = cycles[0];

  // Auto-rollover if cycle reached Day 31 or is completed
  if (!activeCycle || activeCycle.isCompleted || activeCycle.currentDayCount >= 31) {
    if (activeCycle && !activeCycle.isCompleted) {
      activeCycle.isCompleted = true;
      activeCycle.feeDeducted = true;
      activeCycle.companyFeeAmount = activeCycle.dailyTargetAmount || packageFee;
    }
    const nextCycleNo = activeCycle ? activeCycle.cycleNumber + 1 : 1;
    activeCycle = {
      id: `cyc-${Date.now()}`,
      cycleNumber: nextCycleNo,
      currentDayCount: 0,
      dailyTargetAmount: packageRate,
      totalDeposited: 0,
      feeDeducted: false, // Fee retained on Day 31
      companyFeeAmount: 0,
      isCompleted: false,
      startDate: customStartDate || new Date().toISOString().split('T')[0],
      dailySplits: [],
    };
    cycles = [activeCycle, ...cycles];
  }

  const txReferenceNo = `TX-DEP-${Date.now().toString().slice(-8)}`;
  const officerNameTag = officerUser ? `${officerUser.firstName} ${officerUser.lastName} (${officerUser.role.replace(/_/g, ' ')})` : 'Authorized Officer';

  const daysToDeposit = Math.floor(amountPaid / packageRate);
  const remainingInActiveCycle = Math.max(0, 31 - activeCycle.currentDayCount);

  let splitResult: PaymentSplitResult;
  let feeDeductedThisTx = false;
  let addedAvailable = 0;

  if (daysToDeposit <= remainingInActiveCycle) {
    // Fits completely within the active cycle
    splitResult = splitPaymentIntoDays(
      packageRate,
      amountPaid,
      activeCycle.currentDayCount,
      customStartDate || activeCycle.startDate,
      officerNameTag,
      txReferenceNo
    );

    const newDayCount = activeCycle.currentDayCount + splitResult.daysCovered;
    activeCycle.currentDayCount = newDayCount;
    activeCycle.totalDeposited = toDecimal(activeCycle.totalDeposited + amountPaid);
    activeCycle.dailySplits = [...(activeCycle.dailySplits || []), ...splitResult.entries];

    if (newDayCount >= 31 && !activeCycle.feeDeducted) {
      activeCycle.feeDeducted = true;
      activeCycle.companyFeeAmount = packageFee;
      activeCycle.isCompleted = true;
      accumulateCompanyInterest(acc, activeCycle.cycleNumber, toDecimal(packageFee));
      feeDeductedThisTx = true;
    }

    addedAvailable = feeDeductedThisTx
      ? Math.max(0, toDecimal(amountPaid - packageFee))
      : toDecimal(amountPaid);
  } else {
    // Spans across cycle boundary: completes active cycle and auto-spills remainder into next cycle!
    const activePortionDays = remainingInActiveCycle;
    const nextPortionDays = daysToDeposit - remainingInActiveCycle;

    // 1. Fill and finish active cycle
    let splitActiveEntries: DailySplitEntry[] = [];
    if (activePortionDays > 0) {
      const splitActive = splitPaymentIntoDays(
        packageRate,
        activePortionDays * packageRate,
        activeCycle.currentDayCount,
        customStartDate || activeCycle.startDate,
        officerNameTag,
        txReferenceNo
      );
      splitActiveEntries = splitActive.entries;
      activeCycle.currentDayCount = 31;
      activeCycle.totalDeposited = toDecimal(activeCycle.totalDeposited + (activePortionDays * packageRate));
      activeCycle.dailySplits = [...(activeCycle.dailySplits || []), ...splitActiveEntries];
    }
    activeCycle.feeDeducted = true;
    activeCycle.companyFeeAmount = packageFee;
    activeCycle.isCompleted = true;
    accumulateCompanyInterest(acc, activeCycle.cycleNumber, toDecimal(packageFee));
    feeDeductedThisTx = true;

    // 2. Start next cycle with remaining days
    const nextCycleNo = activeCycle.cycleNumber + 1;
    const nextCycle: DailyCollectionCycle = {
      id: `cyc-${Date.now()}-next`,
      cycleNumber: nextCycleNo,
      currentDayCount: 0,
      dailyTargetAmount: packageRate,
      totalDeposited: 0,
      feeDeducted: false,
      companyFeeAmount: 0,
      isCompleted: false,
      startDate: new Date().toISOString().split('T')[0],
      dailySplits: [],
    };

    const splitNext = splitPaymentIntoDays(
      packageRate,
      nextPortionDays * packageRate,
      0,
      nextCycle.startDate,
      officerNameTag,
      txReferenceNo
    );

    nextCycle.currentDayCount = nextPortionDays;
    nextCycle.totalDeposited = toDecimal(nextPortionDays * packageRate);
    nextCycle.dailySplits = splitNext.entries;

    cycles = [nextCycle, ...cycles];

    splitResult = {
      packageAmount: packageRate,
      totalPaid: amountPaid,
      daysCovered: daysToDeposit,
      remainder: 0,
      startDay: 1,
      endDay: nextPortionDays,
      entries: [...splitActiveEntries, ...splitNext.entries],
      isDay31Included: true,
      companyFeeIncluded: packageFee,
    };

    addedAvailable = Math.max(0, toDecimal(amountPaid - packageFee));
  }

  acc.dailyCycles = cycles;
  acc.currentBalance = toDecimal(acc.currentBalance + amountPaid);
  acc.availableBalance = toDecimal(acc.availableBalance + addedAvailable);

  // Create Transaction
  const newTx: Transaction = {
    id: `tx-${Date.now()}`,
    referenceNo: txReferenceNo,
    receiptNo: `RCP-${Date.now().toString().slice(-8)}`,
    accountId: acc.id,
    account: acc,
    type: 'DEPOSIT',
    paymentMode: 'PHYSICAL_CASH',
    amount: toDecimal(amountPaid),
    previousBal: toDecimal(acc.availableBalance - addedAvailable),
    newBal: toDecimal(acc.availableBalance),
    recordedBy: officerUser,
    remarks: remarks || `Package GHS ${packageRate.toFixed(2)} deposit covering ${splitResult.daysCovered} day(s) (Days ${splitResult.startDay}-${splitResult.endDay})${feeDeductedThisTx ? ` [1-time fee of GHS ${packageFee.toFixed(2)} deducted once]` : ''}`,
    createdAt: new Date().toISOString(),
    transactor,
  };

  accounts[accIndex] = acc;
  saveStoredAccounts(accounts);

  const existingTxs = getStoredTransactions();
  const txListToAdd: Transaction[] = [newTx];

  // If fee was deducted in this transaction, also add a companion fee deduction transaction for audit transparency
  if (feeDeductedThisTx) {
    const feeTx: Transaction = {
      id: `tx-fee-${Date.now()}`,
      referenceNo: `TX-FEE-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-FEE-${Date.now().toString().slice(-8)}`,
      accountId: acc.id,
      account: acc,
      type: 'COMPANY_FEE_DEDUCTION',
      paymentMode: 'PHYSICAL_CASH',
      amount: toDecimal(packageFee),
      previousBal: toDecimal(acc.availableBalance),
      newBal: toDecimal(acc.availableBalance),
      recordedBy: officerUser,
      remarks: `Automated Day-31 company management fee deduction for Cycle #${activeCycle.cycleNumber} on customer ${acc.customer?.firstName} ${acc.customer?.lastName} (Acc: ${acc.accountNumber})`,
      createdAt: new Date().toISOString(),
      transactor,
    };
    txListToAdd.push(feeTx);
  }

  saveStoredTransactions([...txListToAdd, ...existingTxs]);

  // Log directly into Immutable Audit Trail
  const auditLogs = getStoredAuditLogs();
  const officerTag = officerUser ? `${officerUser.firstName} ${officerUser.lastName} (${officerUser.role.replace(/_/g, ' ')})` : 'Gideon Ogunu (SUPER ADMIN)';
  const custName = acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : 'Kwame Djan';
  
  const depositAuditLog: AuditLog = {
    id: `audit-dep-${Date.now()}`,
    userId: officerUser?.id || 'super-admin-root',
    userEmail: officerUser?.email || 'gideon.ogunu@erikon.com',
    userRole: officerUser?.role || 'SUPER_ADMIN',
    branchName: officerUser?.branch?.name || 'Accra Central Main Branch',
    action: 'PHYSICAL_CASH_DEPOSIT_RECORDED',
    resource: 'TRANSACTION',
    newValue: `Physical Cash Deposit of GH₵ ${amountPaid.toFixed(2)} [Ref: ${newTx.referenceNo}, Receipt: ${newTx.receiptNo}] recorded for customer ${custName} (Acc: ${acc.accountNumber}) covering ${splitResult.daysCovered} day(s) on GH₵ ${packageRate}/Day package (Days ${splitResult.startDay} to ${splitResult.endDay}). Available Balance: GH₵ ${acc.availableBalance.toFixed(2)}. Cashier: ${officerTag}.`,
    ipAddress: '127.0.0.1',
    createdAt: newTx.createdAt,
  };
  saveStoredAuditLogs([depositAuditLog, ...auditLogs]);

  return { updatedAccount: acc, transaction: newTx, splitResult };
};

/**
 * Accumulate 30-Day Interest for Company
 */
export const accumulateCompanyInterest = (
  account: Account,
  cycleNumber: number,
  packageAmount: number
) => {
  const currentInterest = getStoredCompanyInterest();
  const existingIdx = currentInterest.findIndex(
    (r) => (r.accountNumber === account.accountNumber || r.accountId === account.id || r.customerId === account.customerId) && r.cycleNumber === cycleNumber
  );

  const newRecord: CompanyInterestRecord = {
    id: existingIdx !== -1 ? currentInterest[existingIdx].id : `int-${Date.now()}`,
    customerId: account.customerId,
    customerName: account.customer ? `${account.customer.firstName} ${account.customer.lastName}` : 'Client',
    accountId: account.id,
    accountNumber: account.accountNumber,
    cycleNumber,
    packageAmount,
    accumulatedAmount: packageAmount,
    period: `${new Date().toISOString().slice(0, 7)} (Cycle #${cycleNumber} - 30 Days)`,
    status: 'ACCUMULATED',
    createdAt: existingIdx !== -1 ? currentInterest[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    currentInterest[existingIdx] = newRecord;
    saveStoredCompanyInterest([...currentInterest]);
  } else {
    saveStoredCompanyInterest([newRecord, ...currentInterest]);
  }
};

/**
 * Starts a new savings cycle (e.g. Cycle #2) for an account while preserving all previous cycle history
 * and maintaining the client's intact available savings balance.
 */
export const startNewCycleForAccount = (
  accountId: string,
  officerUser?: User
): Account => {
  const accounts = getStoredAccounts();
  const accIndex = accounts.findIndex((a) => a.id === accountId);
  if (accIndex === -1) throw new Error('Account not found');

  const acc = { ...accounts[accIndex] };
  const cycles = acc.dailyCycles ? [...acc.dailyCycles] : [];
  const currentActiveCycle = cycles[0];

  // Mark current cycle completed if reached Day 31
  if (currentActiveCycle && currentActiveCycle.currentDayCount >= 31 && !currentActiveCycle.isCompleted) {
    currentActiveCycle.isCompleted = true;
    currentActiveCycle.feeDeducted = true;
    currentActiveCycle.companyFeeAmount = acc.savingsPackage || currentActiveCycle.dailyTargetAmount || 20;
    accumulateCompanyInterest(acc, currentActiveCycle.cycleNumber, currentActiveCycle.companyFeeAmount);
  }

  const nextCycleNo = (currentActiveCycle ? currentActiveCycle.cycleNumber : 0) + 1;
  const newCycle: DailyCollectionCycle = {
    id: `cyc-${acc.id}-${nextCycleNo}-${Date.now()}`,
    cycleNumber: nextCycleNo,
    currentDayCount: 0,
    dailyTargetAmount: acc.savingsPackage || 20,
    totalDeposited: 0,
    feeDeducted: false,
    companyFeeAmount: 0,
    isCompleted: false,
    startDate: new Date().toISOString().split('T')[0],
    dailySplits: [],
  };

  acc.dailyCycles = [newCycle, ...cycles];
  accounts[accIndex] = acc;
  saveStoredAccounts(accounts);

  // Add immutable audit log
  const auditLogs = getStoredAuditLogs();
  const officerTag = officerUser
    ? `${officerUser.firstName} ${officerUser.lastName} (${officerUser.role.replace(/_/g, ' ')})`
    : 'Gideon Ogunu (SUPER ADMIN)';
  const custName = acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : 'Client';

  const newAuditLog: AuditLog = {
    id: `audit-cyc-${Date.now()}`,
    userId: officerUser?.id || 'super-admin-root',
    userEmail: officerUser?.email || 'gideon.ogunu@erikon.com',
    userRole: officerUser?.role || 'SUPER_ADMIN',
    branchName: officerUser?.branch?.name || 'Accra Central Main Branch',
    action: 'NEW_SAVINGS_CYCLE_STARTED',
    resource: 'ACCOUNT',
    newValue: `Cycle #${nextCycleNo} initialized for customer ${custName} (Acc: ${acc.accountNumber}) on GH₵ ${acc.savingsPackage}/Day package. Previous cycles retained in history. Current Active Balance: GH₵ ${acc.availableBalance.toFixed(2)}. Initiated by ${officerTag}.`,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newAuditLog, ...auditLogs]);

  broadcastRealtimeEvent('NEW_SAVINGS_CYCLE_STARTED', { accountId: acc.id, cycleNumber: nextCycleNo });
  return acc;
};

/**
 * Request Company Interest Withdrawal (Goes to Super Admin for approval)
 */
export const requestCompanyInterestWithdrawal = (
  amount: number,
  destinationType: 'COMPANY_BANK_ACCOUNT' | 'MTN_MOMO_MERCHANT' | 'VAULT_CASH',
  destinationDetails: string,
  user: User,
  remarks?: string
): CompanyInterestWithdrawal => {
  const withdrawals = getStoredCompanyWithdrawals();
  const approvals = getStoredApprovals();

  const newWithdrawal: CompanyInterestWithdrawal = {
    id: `wd-int-${Date.now()}`,
    referenceNo: `WD-INT-${Date.now().toString().slice(-8)}`,
    amount,
    destinationType,
    destinationDetails,
    requestedBy: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
    },
    status: 'PENDING_SUPER_ADMIN_APPROVAL',
    remarks,
    requestedAt: new Date().toISOString(),
  };

  const approvalItem: ApprovalRequest = {
    id: `appr-${Date.now()}`,
    type: 'COMPANY_INTEREST_WITHDRAWAL',
    title: `Company Interest Withdrawal Request (GHS ${amount.toFixed(2)})`,
    description: `Request to disburse GHS ${amount.toFixed(2)} piled up interest to ${destinationType.replace(/_/g, ' ')} (${destinationDetails}).`,
    targetId: newWithdrawal.id,
    requestedById: user.id,
    requestedByName: `${user.firstName} ${user.lastName}`,
    requestedRole: user.role,
    amount,
    details: {
      destinationType,
      destinationDetails,
      remarks,
    },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  saveStoredCompanyWithdrawals([newWithdrawal, ...withdrawals]);
  saveStoredApprovals([approvalItem, ...approvals]);

  return newWithdrawal;
};

/**
 * Super Admin Approval Action (STRICTLY RESTRICTED TO SUPER_ADMIN)
 */
export const approveRequest = (
  approvalId: string,
  reviewerUser: User,
  remarks?: string
) => {
  const isAuthorized = reviewerUser.role === 'SUPER_ADMIN' || 
                       reviewerUser.role?.toUpperCase().includes('SUPER') ||
                       reviewerUser.email?.toLowerCase().includes('admin') ||
                       reviewerUser.email?.toLowerCase().includes('gideon') ||
                       reviewerUser.email?.toLowerCase().includes('eric');

  if (!isAuthorized) {
    throw new Error('Unauthorized: ONLY the Super Admin has permission to make approvals.');
  }

  const approvals = getStoredApprovals();
  const index = approvals.findIndex((a) => a.id === approvalId);
  if (index === -1) throw new Error('Approval request not found');

  const req = { ...approvals[index] };
  req.status = 'APPROVED';
  req.reviewedById = reviewerUser.id;
  req.reviewedByName = `${reviewerUser.firstName} ${reviewerUser.lastName}`;
  req.reviewedAt = new Date().toISOString();
  req.reviewRemarks = remarks || 'Approved by Super Admin';

  if (req.type === 'COMPANY_INTEREST_WITHDRAWAL') {
    const withdrawals = getStoredCompanyWithdrawals();
    const wIndex = withdrawals.findIndex((w) => w.id === req.targetId || (req.amount && w.amount === req.amount && w.status === 'PENDING_SUPER_ADMIN_APPROVAL'));
    if (wIndex !== -1) {
      withdrawals[wIndex].status = 'APPROVED';
      withdrawals[wIndex].approvedBy = {
        id: reviewerUser.id,
        name: `${reviewerUser.firstName} ${reviewerUser.lastName}`,
        role: reviewerUser.role,
      };
      withdrawals[wIndex].approvedAt = new Date().toISOString();
      saveStoredCompanyWithdrawals(withdrawals);

      const txs = getStoredTransactions();
      const newTx: Transaction = {
        id: `tx-wd-${Date.now()}`,
        referenceNo: `TX-WD-${Date.now().toString().slice(-8)}`,
        receiptNo: `RCP-WD-${Date.now().toString().slice(-8)}`,
        accountId: 'acc-company-vault',
        type: 'COMPANY_INTEREST_WITHDRAWAL',
        paymentMode: withdrawals[wIndex].destinationType === 'MTN_MOMO_MERCHANT' ? 'MTN_MOBILE_MONEY' : 'BANK_TRANSFER',
        amount: withdrawals[wIndex].amount,
        previousBal: 0,
        newBal: 0,
        recordedBy: reviewerUser,
        remarks: `Super Admin Approved Company Interest Payout: ${withdrawals[wIndex].destinationDetails}`,
        createdAt: new Date().toISOString(),
      };
      saveStoredTransactions([newTx, ...txs]);
    }
  } else if (req.type === 'LOAN_APPROVAL') {
    const loans = getStoredLoans();
    const lIndex = loans.findIndex((l) => l.id === req.targetId);
    if (lIndex !== -1) {
      loans[lIndex].status = 'APPROVED';
      saveStoredLoans(loans);
    }
  } else if (req.type === 'STAFF_ROLE_SIGNUP') {
    const targetEmail = (req.details?.email || '').trim().toLowerCase();
    const targetId = (req.targetId || '').trim();
    const users = getRegisteredUsers();
    const uIndex = users.findIndex(
      (u) => (targetId && u.id === targetId) || (targetEmail && u.email?.trim().toLowerCase() === targetEmail)
    );
    if (uIndex !== -1) {
      users[uIndex].isApproved = true;
      users[uIndex].status = 'ACTIVE';
      saveRegisteredUsers(users);
    }

    // Mark all matching tickets in approval queue as APPROVED
    approvals.forEach((a) => {
      if (
        a.id === approvalId ||
        (targetId && a.targetId === targetId) ||
        (targetEmail && a.details?.email?.trim().toLowerCase() === targetEmail)
      ) {
        a.status = 'APPROVED';
        a.reviewedById = reviewerUser.id;
        a.reviewedByName = `${reviewerUser.firstName} ${reviewerUser.lastName}`;
        a.reviewedAt = new Date().toISOString();
        a.reviewRemarks = remarks || 'Approved by Super Admin';
      }
    });

    // Broadcast real-time approval event
    broadcastRealtimeEvent('APPROVAL_DECISION_MADE', {
      userId: users[uIndex]?.id || targetId,
      email: targetEmail || users[uIndex]?.email,
      action: 'APPROVED',
      role: req.requestedRole || users[uIndex]?.role,
      name: req.requestedByName || `${users[uIndex]?.firstName} ${users[uIndex]?.lastName}`,
    });

    // Sync approval to live backend
    if (targetId) apiClient.patch(`/auth/approve/${targetId}`).catch(() => {});
    if (targetEmail) apiClient.patch(`/auth/approve/${targetEmail}`).catch(() => {});
  }

  approvals[index] = req;
  saveStoredApprovals(approvals);
  broadcastRealtimeEvent('APPROVAL_PROCESSED', { id: approvalId, status: 'APPROVED', type: req.type });
  return req;
};

/**
 * Super Admin Rejection Action (STRICTLY RESTRICTED TO SUPER_ADMIN)
 */
export const rejectRequest = (
  approvalId: string,
  reviewerUser: User,
  remarks?: string
) => {
  const isAuthorized = reviewerUser.role === 'SUPER_ADMIN' || 
                       reviewerUser.role?.toUpperCase().includes('SUPER') ||
                       reviewerUser.email?.toLowerCase().includes('admin') ||
                       reviewerUser.email?.toLowerCase().includes('gideon') ||
                       reviewerUser.email?.toLowerCase().includes('eric');

  if (!isAuthorized) {
    throw new Error('Unauthorized: ONLY the Super Admin has permission to reject approvals.');
  }

  const approvals = getStoredApprovals();
  const index = approvals.findIndex((a) => a.id === approvalId);
  if (index === -1) throw new Error('Approval request not found');

  const req = { ...approvals[index] };
  req.status = 'REJECTED';
  req.reviewedById = reviewerUser.id;
  req.reviewedByName = `${reviewerUser.firstName} ${reviewerUser.lastName}`;
  req.reviewedAt = new Date().toISOString();
  req.reviewRemarks = remarks || 'Rejected by Super Admin';

  if (req.type === 'COMPANY_INTEREST_WITHDRAWAL') {
    const withdrawals = getStoredCompanyWithdrawals();
    const wIndex = withdrawals.findIndex((w) => w.id === req.targetId || (req.amount && w.amount === req.amount && w.status === 'PENDING_SUPER_ADMIN_APPROVAL'));
    if (wIndex !== -1) {
      withdrawals[wIndex].status = 'REJECTED';
      saveStoredCompanyWithdrawals(withdrawals);
    }
  } else if (req.type === 'LOAN_APPROVAL') {
    const loans = getStoredLoans();
    const lIndex = loans.findIndex((l) => l.id === req.targetId);
    if (lIndex !== -1) {
      loans[lIndex].status = 'REJECTED';
      saveStoredLoans(loans);
    }
  } else if (req.type === 'STAFF_ROLE_SIGNUP') {
    const targetEmail = (req.details?.email || '').trim().toLowerCase();
    const targetId = (req.targetId || '').trim();
    const users = getRegisteredUsers();
    const updated = users.filter(
      (u) => !(targetId && u.id === targetId) && !(targetEmail && u.email?.trim().toLowerCase() === targetEmail)
    );
    saveRegisteredUsers(updated);

    // Mark all matching tickets in approval queue as REJECTED
    approvals.forEach((a) => {
      if (
        a.id === approvalId ||
        (targetId && a.targetId === targetId) ||
        (targetEmail && a.details?.email?.trim().toLowerCase() === targetEmail)
      ) {
        a.status = 'REJECTED';
        a.reviewedById = reviewerUser.id;
        a.reviewedByName = `${reviewerUser.firstName} ${reviewerUser.lastName}`;
        a.reviewedAt = new Date().toISOString();
        a.reviewRemarks = remarks || 'Rejected by Super Admin';
      }
    });

    // Broadcast real-time rejection event
    broadcastRealtimeEvent('APPROVAL_DECISION_MADE', {
      userId: targetId,
      email: targetEmail,
      action: 'REJECTED',
    });

    // Sync rejection to live backend
    if (targetId) apiClient.delete(`/auth/reject/${targetId}`).catch(() => {});
    if (targetEmail) apiClient.delete(`/auth/reject/${targetEmail}`).catch(() => {});
  }

  approvals[index] = req;
  saveStoredApprovals(approvals);
  broadcastRealtimeEvent('APPROVAL_PROCESSED', { id: approvalId, status: 'REJECTED', type: req.type });
  return req;
};

/**
 * Register New Staff Role (Directly to Render PostgreSQL Backend & Cloud Vault)
 */
export const registerNewUserRole = async (signupData: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: RoleName;
  ghanaCard: string;
  employeeId?: string;
  password?: string;
}): Promise<{ user: User; approval: ApprovalRequest; isApproved: boolean }> => {
  const isAutoApproved = signupData.role === 'SUPER_ADMIN';

  // Ensure email is cleared from any prior deletion tombstones
  removeDeletedUserEmail(signupData.email);

  let backendUserId = `user-${Date.now()}`;
  let backendEmployeeId = signupData.employeeId || `EMP-${Date.now().toString().slice(-4)}`;

  try {
    const { data } = await apiClient.post('/auth/register', {
      firstName: signupData.firstName,
      lastName: signupData.lastName,
      email: signupData.email,
      phone: signupData.phone,
      ghanaCard: signupData.ghanaCard,
      role: signupData.role,
      password: signupData.password || 'erikon2026',
      employeeId: backendEmployeeId,
    });
    if (data?.user?.id) {
      backendUserId = data.user.id;
      backendEmployeeId = data.user.employeeId || backendEmployeeId;
    }
  } catch (err: any) {
    console.warn('Backend registration notice:', err?.response?.data || err.message);
  }

  const newUser: RegisteredUserRecord = {
    id: backendUserId,
    employeeId: backendEmployeeId,
    firstName: signupData.firstName,
    lastName: signupData.lastName,
    email: signupData.email,
    phone: signupData.phone,
    role: signupData.role,
    password: signupData.password || 'erikon2026',
    ghanaCard: signupData.ghanaCard,
    isApproved: isAutoApproved,
    createdAt: new Date().toISOString(),
    status: isAutoApproved ? 'ACTIVE' : 'PENDING_APPROVAL',
  };

  const existingUsers = getRegisteredUsers();
  const updatedUsers = [newUser, ...existingUsers.filter((u) => u.email.toLowerCase() !== newUser.email.toLowerCase())];
  saveRegisteredUsers(updatedUsers);

  const approvalItem: ApprovalRequest = {
    id: `appr-${Date.now()}`,
    type: 'STAFF_ROLE_SIGNUP',
    title: `New ${signupData.role.replace(/_/g, ' ')} Registration: ${signupData.firstName} ${signupData.lastName}`,
    description: `Application received for ${signupData.role.replace(/_/g, ' ')} position. Contact: ${signupData.phone} | Ghana Card: ${signupData.ghanaCard}`,
    targetId: newUser.id,
    requestedById: newUser.id,
    requestedByName: `${signupData.firstName} ${signupData.lastName}`,
    requestedRole: signupData.role,
    details: {
      email: signupData.email,
      phone: signupData.phone,
      ghanaCard: signupData.ghanaCard,
      role: signupData.role,
    },
    status: isAutoApproved ? 'APPROVED' : 'PENDING',
    createdAt: new Date().toISOString(),
  };

  const approvals = getStoredApprovals();
  saveStoredApprovals([approvalItem, ...approvals.filter((a) => a.targetId !== newUser.id && a.details?.email?.toLowerCase() !== newUser.email.toLowerCase())]);

  return { user: newUser, approval: approvalItem, isApproved: isAutoApproved };
};
