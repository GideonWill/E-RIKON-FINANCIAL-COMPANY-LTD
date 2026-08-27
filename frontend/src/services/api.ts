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
  timeout: 35000,
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
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const deletedIds = getDeletedCustomerIds();
    return parsed.filter((c) => !deletedIds.includes(c.id));
  } catch {
    return [];
  }
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
        acc = {
          id: `acc-${cust.id.replace('cust-', '')}`,
          accountNumber: `ACC-1001-${cust.customerNumber ? cust.customerNumber.replace(/\D/g, '').slice(-4) : Math.floor(1000 + Math.random() * 9000)}`,
          customerId: cust.id,
          customer: cust,
          type: 'SAVINGS',
          savingsPackage: 20,
          currentBalance: 0,
          availableBalance: 0,
          interestRate: 0.0,
          status: 'ACTIVE',
          openingDate: cust.createdAt || new Date().toISOString(),
          dailyCycles: [
            {
              id: `cyc-${cust.id.replace('cust-', '')}`,
              cycleNumber: 1,
              currentDayCount: 0,
              dailyTargetAmount: 20,
              totalDeposited: 0,
              feeDeducted: false,
              companyFeeAmount: 0,
              isCompleted: false,
              startDate: new Date().toISOString().split('T')[0],
              dailySplits: [],
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
  const existingTxs = getStoredTransactions();
  let splitsUpdated = false;

  parsed.forEach((acc) => {
    if (!acc.customer && acc.customerId) {
      const c = customers.find((cust) => cust.id === acc.customerId);
      if (c) acc.customer = c;
    }

    (acc.dailyCycles || []).forEach((c) => {
      (c.dailySplits || []).forEach((s) => {
        if (!s.recordedBy || s.recordedBy.trim() === '' || s.recordedBy === 'Authorized Officer') {
          const matchingTx = existingTxs.find((t) => t.referenceNo === s.batchTxRef || t.accountId === acc.id);
          if (matchingTx?.recordedBy?.firstName && matchingTx.recordedBy.firstName !== 'Authorized') {
            const role = (matchingTx.recordedBy.role || 'SUPER_ADMIN').replace(/_/g, ' ');
            s.recordedBy = `${matchingTx.recordedBy.firstName} ${matchingTx.recordedBy.lastName} (${role})`;
          } else {
            s.recordedBy = 'Gideon Ogunu (SUPER ADMIN)';
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
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const deletedIds = getDeletedCustomerIds();
    const currentCustomers = getStoredCustomers();
    if (currentCustomers.length === 0) return [];
    const currentCustomerIds = new Set(currentCustomers.map((c) => c.id));
    return parsed
      .filter((t) => {
        const custId = t.account?.customerId || t.account?.customer?.id;
        if (custId && (deletedIds.includes(custId) || !currentCustomerIds.has(custId))) return false;
        if (deletedIds.includes(t.id) || (t.receiptNo && deletedIds.includes(t.receiptNo))) return false;
        return true;
      })
      .map((t) => {
        // Ensure immutable real officer object
        if (!t.recordedBy || !t.recordedBy.firstName || t.recordedBy.firstName === 'Authorized') {
          return {
            ...t,
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
          };
        }
        return t;
      });
  } catch {
    return [];
  }
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
  const currentAccNos = new Set(getStoredAccounts().map((a) => a.accountNumber));
  const data = localStorage.getItem('erikon_company_interest');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const deletedIds = getDeletedCustomerIds();
    return parsed.filter((r) => {
      if (r.customerId && (deletedIds.includes(r.customerId) || !currentCustomerIds.has(r.customerId))) return false;
      if (r.accountNumber && !currentAccNos.has(r.accountNumber)) return false;
      return true;
    });
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
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
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
  // 1. Add to permanent deleted tombstones
  addDeletedCustomerId(customerId);

  // 2. Remove from stored customers
  const customers = getStoredCustomers();
  const targetCust = customers.find((c) => c.id === customerId);
  const updatedCusts = customers.filter((c) => c.id !== customerId);
  saveStoredCustomers(updatedCusts);

  // 3. Remove associated accounts
  const accounts = getStoredAccounts();
  const updatedAccs = accounts.filter((a) => a.customerId !== customerId);
  saveStoredAccounts(updatedAccs);

  // 4. Remove associated loans
  const loans = getStoredLoans();
  const updatedLoans = loans.filter((l) => l.customerId !== customerId);
  saveStoredLoans(updatedLoans);

  // 5. Record audit log
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

  // 6. Broadcast real-time deletion event across all open windows & mobile devices
  broadcastRealtimeEvent('CUSTOMER_DELETED', { customerId });

  // 7. Delete from backend Neon database if connected
  apiClient.delete(`/customers/${customerId}`).catch(() => { });

  // 8. Immediately push updated state to cloud relay
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
  customStartDate?: string
): { updatedAccount: Account; transaction: Transaction; splitResult: PaymentSplitResult } => {
  const accounts = getStoredAccounts();
  const accIndex = accounts.findIndex((a) => a.id === accountId);
  if (accIndex === -1) throw new Error('Account not found');

  const acc = { ...accounts[accIndex] };
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

  if (!activeCycle || activeCycle.isCompleted || activeCycle.currentDayCount >= 31) {
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

  const splitResult = splitPaymentIntoDays(
    packageRate,
    amountPaid,
    activeCycle.currentDayCount,
    customStartDate || activeCycle.startDate,
    officerNameTag,
    txReferenceNo
  );

  // Update Cycle
  const newDayCount = Math.min(31, activeCycle.currentDayCount + splitResult.daysCovered);
  activeCycle.currentDayCount = newDayCount;
  activeCycle.totalDeposited = toDecimal(activeCycle.totalDeposited + amountPaid);
  activeCycle.dailySplits = [...(activeCycle.dailySplits || []), ...splitResult.entries];
  
  let feeDeductedThisTx = false;
  if (newDayCount >= 31 && !activeCycle.feeDeducted) {
    activeCycle.feeDeducted = true;
    activeCycle.companyFeeAmount = packageFee;
    activeCycle.isCompleted = true;
    accumulateCompanyInterest(acc, activeCycle.cycleNumber, toDecimal(packageFee));
    feeDeductedThisTx = true;
  }

  // Days 1-30: 100% is available savings. Day 31: 1 day retained as company fee.
  const addedAvailable = feeDeductedThisTx
    ? Math.max(0, toDecimal(amountPaid - packageFee))
    : toDecimal(amountPaid);

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
      remarks: `1-Day package fee (GHS ${packageFee.toFixed(2)}) deducted once for GHS ${packageRate}/day cycle #${activeCycle.cycleNumber}`,
      createdAt: new Date().toISOString(),
    };
    txListToAdd.push(feeTx);
  }

  saveStoredTransactions([...txListToAdd, ...existingTxs]);

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
      role: req.requestedRole,
      name: req.requestedByName,
    });

    // Sync rejection to live backend
    if (targetId) apiClient.delete(`/auth/reject/${targetId}`).catch(() => {});
    if (targetEmail) apiClient.delete(`/auth/reject/${targetEmail}`).catch(() => {});
  }

  approvals[index] = req;
  saveStoredApprovals(approvals);
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
