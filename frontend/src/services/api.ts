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
  ApprovalRequest
} from '../types';
import { broadcastRealtimeEvent } from './realtimeSync';

// Financial Precision Helper: Ensures exact 2-decimal arithmetic (no float anomalies)
export const toDecimal = (val: number | string): number => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return 0.00;
  return Math.round(num * 100) / 100;
};

// API Base URL (Defaults to live Render backend in production and localhost in dev)
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
  timeout: 10000,
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

export const getStoredCustomers = (): Customer[] => {
  const data = localStorage.getItem('erikon_customers');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredCustomers = (customers: Customer[]) => {
  const sanitized = customers.map((c) => {
    const { accounts: _, ...rest } = c;
    return rest as Customer;
  });
  localStorage.setItem('erikon_customers', JSON.stringify(sanitized));
  broadcastRealtimeEvent('CUSTOMER_REGISTERED', sanitized);
};

export const getStoredAccounts = (): Account[] => {
  const data = localStorage.getItem('erikon_accounts');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredAccounts = (accounts: Account[]) => {
  const sanitized = accounts.map((a) => {
    if (a.customer) {
      const { accounts: _, ...cleanCust } = a.customer;
      return { ...a, customer: cleanCust as Customer };
    }
    return a;
  });
  localStorage.setItem('erikon_accounts', JSON.stringify(sanitized));
  broadcastRealtimeEvent('ACCOUNT_OPENED', sanitized);
};

export const getStoredLoans = (): LoanApplication[] => {
  const data = localStorage.getItem('erikon_loans');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredLoans = (loans: LoanApplication[]) => {
  localStorage.setItem('erikon_loans', JSON.stringify(loans));
  broadcastRealtimeEvent('LOAN_CREATED', loans);
};

export const getStoredTransactions = (): Transaction[] => {
  const data = localStorage.getItem('erikon_transactions');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredTransactions = (txs: Transaction[]) => {
  const sanitized = txs.map((t) => {
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
  const data = localStorage.getItem('erikon_company_interest');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
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
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredAuditLogs = (logs: AuditLog[]) => {
  localStorage.setItem('erikon_audit_logs', JSON.stringify(logs));
};

export interface RegisteredUserRecord extends User {
  password?: string;
  ghanaCard?: string;
}

export const getRegisteredUsers = (): RegisteredUserRecord[] => {
  const data = localStorage.getItem('erikon_registered_users');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveRegisteredUsers = (users: RegisteredUserRecord[]) => {
  localStorage.setItem('erikon_registered_users', JSON.stringify(users));
  broadcastRealtimeEvent('STAFF_REGISTERED', users);
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
  const initialDepositAmount = customerData.initialDeposit || 0;
  const initialDayCount = initialDepositAmount >= packageRate ? Math.floor(initialDepositAmount / packageRate) : 0;

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
    availableBalance: initialDepositAmount,
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
        feeDeducted: false,
        companyFeeAmount: 0,
        isCompleted: false,
        startDate: new Date().toISOString().split('T')[0],
        dailySplits: initialDayCount > 0 ? Array.from({ length: initialDayCount }, (_, i) => ({
          dayNumber: i + 1,
          date: new Date().toISOString().split('T')[0],
          amount: packageRate,
          receiptNo: `RCP-INIT-${Date.now().toString().slice(-4)}-${i + 1}`,
          isCompanyFee: false,
        })) : [],
      },
    ],
  };

  saveStoredCustomers([newCustomer, ...customers]);
  saveStoredAccounts([newAccount, ...accounts]);

  if (initialDepositAmount > 0) {
    const txs = getStoredTransactions();
    const newTx: Transaction = {
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
      remarks: `Initial account opening deposit on GH₵ ${packageRate} daily savings package`,
      createdAt: new Date().toISOString(),
    };
    saveStoredTransactions([newTx, ...txs]);
  }

  return { customer: newCustomer, account: newAccount };
};

/**
 * Delete / Close Customer Record (When client does not want to save anymore)
 */
export const deleteCustomerRecord = (customerId: string): boolean => {
  // 1. Remove from stored customers
  const customers = getStoredCustomers();
  const targetCust = customers.find((c) => c.id === customerId);
  const updatedCusts = customers.filter((c) => c.id !== customerId);
  saveStoredCustomers(updatedCusts);

  // 2. Remove associated accounts
  const accounts = getStoredAccounts();
  const updatedAccs = accounts.filter((a) => a.customerId !== customerId);
  saveStoredAccounts(updatedAccs);

  // 3. Remove associated loans
  const loans = getStoredLoans();
  const updatedLoans = loans.filter((l) => l.customerId !== customerId);
  saveStoredLoans(updatedLoans);

  // 4. Record audit log
  const logs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `log-del-${Date.now()}`,
    userId: 'current-user',
    userEmail: 'staff@erikon-group.com',
    userRole: 'SUPER_ADMIN',
    action: 'CUSTOMER_DELETED',
    resource: 'CUSTOMER',
    previousValue: targetCust ? `${targetCust.firstName} ${targetCust.lastName} (${targetCust.customerNumber})` : customerId,
    newValue: 'CLOSED_AND_DELETED',
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newLog, ...logs]);

  // 5. Broadcast real-time deletion event across all open windows & mobile devices
  broadcastRealtimeEvent('CUSTOMER_DELETED', { customerId });

  // 6. Delete from backend Neon database if connected
  apiClient.delete(`/customers/${customerId}`).catch(() => {});

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
  startDateStr?: string
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

  for (let i = 1; i <= daysCovered; i++) {
    const currentDayNo = startingDay + i;
    const isDay31 = currentDayNo === 31;
    if (isDay31) {
      isDay31Included = true;
      companyFeeIncluded += packageAmount;
    }

    const entryDate = new Date(baseDate);
    entryDate.setDate(entryDate.getDate() + (i - 1));

    entries.push({
      dayNumber: currentDayNo,
      date: entryDate.toISOString().split('T')[0],
      amount: packageAmount,
      receiptNo: `RCP-SPLIT-${Date.now().toString().slice(-6)}-${i}`,
      isCompanyFee: isDay31,
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
 * Record a single or multi-day package deposit with automatic splitting across 30/31 days
 */
export const recordPackageDeposit = (
  accountId: string,
  amountPaid: number,
  officerUser: User,
  remarks?: string,
  customStartDate?: string
): { updatedAccount: Account; transaction: Transaction; splitResult: PaymentSplitResult } => {
  const accounts = getStoredAccounts();
  const accIndex = accounts.findIndex((a) => a.id === accountId);
  if (accIndex === -1) throw new Error('Account not found');

  const acc = { ...accounts[accIndex] };
  const packageRate = acc.savingsPackage || 20;

  let cycles = acc.dailyCycles ? [...acc.dailyCycles] : [];
  let activeCycle = cycles[0];

  if (!activeCycle || activeCycle.isCompleted || activeCycle.currentDayCount >= 31) {
    const nextCycleNo = activeCycle ? activeCycle.cycleNumber + 1 : 1;
    activeCycle = {
      id: `cyc-${Date.now()}`,
      cycleNumber: nextCycleNo,
      currentDayCount: 0,
      dailyTargetAmount: packageRate,
      totalDeposited: 0,
      feeDeducted: false,
      companyFeeAmount: 0,
      isCompleted: false,
      startDate: customStartDate || new Date().toISOString().split('T')[0],
      dailySplits: [],
    };
    cycles = [activeCycle, ...cycles];
  }

  const splitResult = splitPaymentIntoDays(
    packageRate,
    amountPaid,
    activeCycle.currentDayCount,
    customStartDate || activeCycle.startDate
  );

  // Update Cycle
  const newDayCount = Math.min(31, activeCycle.currentDayCount + splitResult.daysCovered);
  activeCycle.currentDayCount = newDayCount;
  activeCycle.totalDeposited += amountPaid;
  activeCycle.dailySplits = [...(activeCycle.dailySplits || []), ...splitResult.entries];

  let addedAvailable = amountPaid;
  if (splitResult.isDay31Included) {
    activeCycle.feeDeducted = true;
    activeCycle.companyFeeAmount += splitResult.companyFeeIncluded;
    activeCycle.isCompleted = true;
    addedAvailable -= splitResult.companyFeeIncluded;

    // Pile up company interest
    accumulateCompanyInterest(acc, activeCycle.cycleNumber, toDecimal(packageRate));
  }

  acc.dailyCycles = cycles;
  acc.currentBalance = toDecimal(acc.currentBalance + amountPaid);
  acc.availableBalance = toDecimal(acc.availableBalance + addedAvailable);

  // Create Transaction
  const newTx: Transaction = {
    id: `tx-${Date.now()}`,
    referenceNo: `TX-DEP-${Date.now().toString().slice(-8)}`,
    receiptNo: `RCP-${Date.now().toString().slice(-8)}`,
    accountId: acc.id,
    account: acc,
    type: splitResult.isDay31Included ? 'COMPANY_FEE_DEDUCTION' : 'DEPOSIT',
    paymentMode: 'PHYSICAL_CASH',
    amount: toDecimal(amountPaid),
    previousBal: toDecimal(acc.availableBalance - addedAvailable),
    newBal: toDecimal(acc.availableBalance),
    recordedBy: officerUser,
    remarks: remarks || `Package GHS ${packageRate.toFixed(2)} deposit covering ${splitResult.daysCovered} day(s) (Days ${splitResult.startDay}-${splitResult.endDay})`,
    createdAt: new Date().toISOString(),
  };

  accounts[accIndex] = acc;
  saveStoredAccounts(accounts);

  const existingTxs = getStoredTransactions();
  saveStoredTransactions([newTx, ...existingTxs]);

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
  const newRecord: CompanyInterestRecord = {
    id: `int-${Date.now()}`,
    customerId: account.customerId,
    customerName: account.customer ? `${account.customer.firstName} ${account.customer.lastName}` : 'Client',
    accountId: account.id,
    accountNumber: account.accountNumber,
    cycleNumber,
    packageAmount,
    accumulatedAmount: packageAmount,
    period: `${new Date().toISOString().slice(0, 7)} (Cycle #${cycleNumber} - 30 Days)`,
    status: 'ACCUMULATED',
    createdAt: new Date().toISOString(),
  };

  saveStoredCompanyInterest([newRecord, ...currentInterest]);
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
  if (reviewerUser.role !== 'SUPER_ADMIN') {
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
    const wIndex = withdrawals.findIndex((w) => w.id === req.targetId);
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
    const users = getRegisteredUsers();
    const uIndex = users.findIndex((u) => u.id === req.targetId || u.email === req.details?.email);
    if (uIndex !== -1) {
      users[uIndex].isApproved = true;
      users[uIndex].status = 'ACTIVE';
      saveRegisteredUsers(users);
    }
    // Sync approval to live backend
    apiClient.patch(`/auth/approve/${req.targetId}`).catch(() => {});
  }

  approvals[index] = req;
  saveStoredApprovals(approvals);
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
  if (reviewerUser.role !== 'SUPER_ADMIN') {
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
    const wIndex = withdrawals.findIndex((w) => w.id === req.targetId);
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
    const users = getRegisteredUsers();
    const updated = users.filter((u) => u.id !== req.targetId && u.email !== req.details?.email);
    saveRegisteredUsers(updated);
    // Sync rejection to live backend
    apiClient.delete(`/auth/reject/${req.targetId}`).catch(() => {});
  }

  approvals[index] = req;
  saveStoredApprovals(approvals);
  return req;
};

/**
 * Register New Staff Role (Directly to Render PostgreSQL Backend)
 */
export const registerNewUserRole = async (signupData: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: RoleName;
  ghanaCard: string;
  employeeId?: string;
  branchId?: string;
  password?: string;
}): Promise<{ user: User; approval: ApprovalRequest; isApproved: boolean }> => {
  const isAutoApproved = signupData.role === 'SUPER_ADMIN';

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
      branchId: signupData.branchId,
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
    branchId: signupData.branchId || 'br-01',
    branch: MOCK_BRANCHES[0],
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
      branch: 'Accra Central Main Branch',
    },
    status: isAutoApproved ? 'APPROVED' : 'PENDING',
    createdAt: new Date().toISOString(),
  };

  const approvals = getStoredApprovals();
  saveStoredApprovals([approvalItem, ...approvals]);

  return { user: newUser, approval: approvalItem, isApproved: isAutoApproved };
};
