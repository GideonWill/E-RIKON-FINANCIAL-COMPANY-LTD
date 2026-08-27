import { 
  getRegisteredUsers, 
  saveRegisteredUsers, 
  getStoredCustomers, 
  saveStoredCustomers, 
  getStoredAccounts, 
  saveStoredAccounts, 
  getStoredTransactions, 
  saveStoredTransactions, 
  getStoredLoans, 
  saveStoredLoans, 
  getStoredCompanyInterest, 
  saveStoredCompanyInterest, 
  getStoredCompanyWithdrawals,
  saveStoredCompanyWithdrawals,
  getStoredApprovals, 
  saveStoredApprovals, 
  getStoredAuditLogs,
  saveStoredAuditLogs,
  getStoredBranches,
  saveStoredBranches,
  RegisteredUserRecord
} from './api';
import { ApprovalRequest } from '../types';
import { broadcastRealtimeEvent, subscribeRealtimeEvents } from './realtimeSync';

export interface CloudVaultPayload {
  registeredUsers?: RegisteredUserRecord[];
  customers?: any[];
  accounts?: any[];
  transactions?: any[];
  loans?: any[];
  companyInterest?: any[];
  companyWithdrawals?: any[];
  approvals?: any[];
  auditLogs?: any[];
  branches?: any[];
  updatedAt?: string;
}

let isPushing = false;
let pushPending = false;
let lastSyncTimestamp: string | null = null;

export const getLastSyncTime = () => lastSyncTimestamp;

/**
 * Returns all active cloud sync endpoints in priority order
 */
const getSyncEndpoints = (): string[] => {
  const endpoints: string[] = [];

  // 1. Same-Origin / Vercel Serverless Function Endpoint (fastest when deployed)
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    endpoints.push(`${window.location.origin}/api/sync`);
  }

  // 2. Production Render Backend Endpoint
  endpoints.push('https://e-rikon-ecfms-backend.onrender.com/api/sync');

  // 3. Localhost Dev Backend (if running locally)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    endpoints.push('http://localhost:4000/api/sync');
  }

  // 4. Custom Environment API URL
  if (import.meta.env.VITE_API_URL) {
    const customUrl = `${import.meta.env.VITE_API_URL}/sync`.replace(/([^:]\/)\/+/g, '$1');
    if (!endpoints.includes(customUrl)) {
      endpoints.push(customUrl);
    }
  }

  return endpoints;
};

/**
 * Pushes all local storage state to all reachable central cloud sync endpoints
 */
export const pushLocalToCloud = async (): Promise<boolean> => {
  if (isPushing) {
    pushPending = true;
    return false;
  }
  isPushing = true;
  pushPending = false;

  const payload: CloudVaultPayload = {
    registeredUsers: getRegisteredUsers(),
    customers: getStoredCustomers(),
    accounts: getStoredAccounts(),
    transactions: getStoredTransactions(),
    loans: getStoredLoans(),
    companyInterest: getStoredCompanyInterest(),
    companyWithdrawals: getStoredCompanyWithdrawals(),
    approvals: getStoredApprovals(),
    auditLogs: getStoredAuditLogs(),
    branches: getStoredBranches(),
    updatedAt: new Date().toISOString(),
  };

  const payloadStr = JSON.stringify(payload);
  const endpoints = getSyncEndpoints();
  let anySuccess = false;

  try {
    const pushPromises = endpoints.map(async (url) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          anySuccess = true;
          return true;
        }
      } catch (e) {
        // Continue trying other endpoints
      }
      return false;
    });

    await Promise.allSettled(pushPromises);
  } finally {
    lastSyncTimestamp = new Date().toLocaleTimeString();
    isPushing = false;
    if (pushPending) {
      setTimeout(() => pushLocalToCloud(), 150);
    }
  }

  return anySuccess;
};

/**
 * Pulls latest state from authoritative cloud backends and merges into local storage
 */
export const pullCloudToLocal = async (): Promise<boolean> => {
  const endpoints = getSyncEndpoints();
  let cloudData: CloudVaultPayload | null = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const vault = data?.vault || data;
        if (
          vault && 
          (Array.isArray(vault.registeredUsers) || Array.isArray(vault.customers) || Array.isArray(vault.accounts))
        ) {
          cloudData = vault;
          break; // Use the fastest responsive endpoint with valid data
        }
      }
    } catch (e) {
      // Continue to next endpoint
    }
  }

  if (!cloudData) return false;

  let hasUpdates = false;

  // 1. Merge & Sync Registered Users
  if (Array.isArray(cloudData.registeredUsers) && cloudData.registeredUsers.length > 0) {
    const localUsers = getRegisteredUsers();
    const userMap = new Map<string, RegisteredUserRecord>();
    
    localUsers.forEach((u) => userMap.set(u.email.toLowerCase(), u));
    
    cloudData.registeredUsers.forEach((u) => {
      const key = u.email.toLowerCase();
      const existing = userMap.get(key);
      const isApproved = Boolean(existing?.isApproved || u.isApproved || u.role === 'SUPER_ADMIN');
      
      userMap.set(key, {
        id: u.id || existing?.id || `user-${Date.now()}`,
        employeeId: u.employeeId || existing?.employeeId || `EMP-${Date.now().toString().slice(-4)}`,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone || existing?.phone || '+233 24 000 0000',
        role: u.role,
        password: u.password || existing?.password || 'erikon2026',
        ghanaCard: u.ghanaCard || existing?.ghanaCard || 'GHA-000000000-0',
        branchId: u.branchId || existing?.branchId || 'br-01',
        branch: u.branch || existing?.branch || { id: 'br-01', name: 'Accra Central Main Branch' } as any,
        isApproved,
        createdAt: u.createdAt || existing?.createdAt || new Date().toISOString(),
        status: isApproved ? 'ACTIVE' : (existing?.status === 'ACTIVE' ? 'ACTIVE' : u.status || 'PENDING_APPROVAL'),
      });
    });

    const mergedUsers = Array.from(userMap.values());
    if (mergedUsers.length !== localUsers.length || JSON.stringify(mergedUsers) !== JSON.stringify(localUsers)) {
      saveRegisteredUsers(mergedUsers);
      hasUpdates = true;
    }
  }

  // 2. Merge & Sync Approvals + Guarantee Pending Clearance Tickets for Super Admin
  const localApprovals = getStoredApprovals();
  const apprMap = new Map<string, ApprovalRequest>();
  localApprovals.forEach((a) => apprMap.set(a.id, a));

  if (Array.isArray(cloudData.approvals)) {
    cloudData.approvals.forEach((incomingAppr: ApprovalRequest) => {
      const existingAppr = apprMap.get(incomingAppr.id);
      if (existingAppr) {
        if (existingAppr.status === 'APPROVED' || existingAppr.status === 'REJECTED') {
          apprMap.set(incomingAppr.id, existingAppr);
        } else {
          apprMap.set(incomingAppr.id, incomingAppr);
        }
      } else {
        apprMap.set(incomingAppr.id, incomingAppr);
      }
    });
  }

  // Ensure all unapproved staff users have active approval tickets in the Super Admin's queue
  const allUsersNow = getRegisteredUsers();
  allUsersNow.forEach((user) => {
    if (!user.isApproved && user.role !== 'SUPER_ADMIN') {
      const matchingAppr = Array.from(apprMap.values()).find(
        (a) => a.targetId === user.id || a.details?.email?.toLowerCase() === user.email.toLowerCase()
      );
      if (!matchingAppr) {
        const newAppId = `appr-${user.id}`;
        apprMap.set(newAppId, {
          id: newAppId,
          type: 'STAFF_ROLE_SIGNUP',
          title: `New ${user.role.replace(/_/g, ' ')} Registration: ${user.firstName} ${user.lastName}`,
          description: `Application received for ${user.role.replace(/_/g, ' ')} position. Contact: ${user.phone || 'N/A'} | Ghana Card: ${user.ghanaCard || 'N/A'}`,
          targetId: user.id,
          requestedById: user.id,
          requestedByName: `${user.firstName} ${user.lastName}`,
          requestedRole: user.role,
          details: {
            email: user.email,
            phone: user.phone,
            ghanaCard: user.ghanaCard,
            role: user.role,
            branch: user.branch?.name || 'Accra Central Main Branch',
          },
          status: 'PENDING',
          createdAt: user.createdAt || new Date().toISOString(),
        });
      }
    }
  });

  const mergedApprovals = Array.from(apprMap.values());
  if (mergedApprovals.length !== localApprovals.length || JSON.stringify(mergedApprovals) !== JSON.stringify(localApprovals)) {
    saveStoredApprovals(mergedApprovals);
    hasUpdates = true;
  }

  // 3. Merge & Sync Customers
  if (Array.isArray(cloudData.customers) && cloudData.customers.length > 0) {
    const localCust = getStoredCustomers();
    const custMap = new Map<string, any>();
    localCust.forEach((c) => custMap.set(c.id, c));
    cloudData.customers.forEach((c) => custMap.set(c.id, c));
    const mergedCust = Array.from(custMap.values());
    if (mergedCust.length !== localCust.length || JSON.stringify(mergedCust) !== JSON.stringify(localCust)) {
      saveStoredCustomers(mergedCust);
      hasUpdates = true;
    }
  }

  // 4. Merge & Sync Accounts
  if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
    const localAcc = getStoredAccounts();
    const accMap = new Map<string, any>();
    localAcc.forEach((a) => accMap.set(a.id, a));
    cloudData.accounts.forEach((a) => accMap.set(a.id, a));
    const mergedAcc = Array.from(accMap.values());
    if (mergedAcc.length !== localAcc.length || JSON.stringify(mergedAcc) !== JSON.stringify(localAcc)) {
      saveStoredAccounts(mergedAcc);
      hasUpdates = true;
    }
  }

  // 5. Merge & Sync Transactions
  if (Array.isArray(cloudData.transactions) && cloudData.transactions.length > 0) {
    const localTx = getStoredTransactions();
    const txMap = new Map<string, any>();
    localTx.forEach((t) => txMap.set(t.id, t));
    cloudData.transactions.forEach((t) => txMap.set(t.id, t));
    const mergedTx = Array.from(txMap.values());
    if (mergedTx.length !== localTx.length || JSON.stringify(mergedTx) !== JSON.stringify(localTx)) {
      saveStoredTransactions(mergedTx);
      hasUpdates = true;
    }
  }

  // 6. Merge & Sync Loans
  if (Array.isArray(cloudData.loans) && cloudData.loans.length > 0) {
    const localLoans = getStoredLoans();
    const loanMap = new Map<string, any>();
    localLoans.forEach((l) => loanMap.set(l.id, l));
    cloudData.loans.forEach((l) => loanMap.set(l.id, l));
    const mergedLoans = Array.from(loanMap.values());
    if (mergedLoans.length !== localLoans.length || JSON.stringify(mergedLoans) !== JSON.stringify(localLoans)) {
      saveStoredLoans(mergedLoans);
      hasUpdates = true;
    }
  }

  // 7. Merge & Sync Company Interest
  if (Array.isArray(cloudData.companyInterest) && cloudData.companyInterest.length > 0) {
    const localInt = getStoredCompanyInterest();
    const intMap = new Map<string, any>();
    localInt.forEach((i) => intMap.set(i.id, i));
    cloudData.companyInterest.forEach((i) => intMap.set(i.id, i));
    const mergedInt = Array.from(intMap.values());
    if (mergedInt.length !== localInt.length || JSON.stringify(mergedInt) !== JSON.stringify(localInt)) {
      saveStoredCompanyInterest(mergedInt);
      hasUpdates = true;
    }
  }

  // 8. Merge & Sync Company Withdrawals
  if (Array.isArray(cloudData.companyWithdrawals) && cloudData.companyWithdrawals.length > 0) {
    const localWd = getStoredCompanyWithdrawals();
    const wdMap = new Map<string, any>();
    localWd.forEach((w) => wdMap.set(w.id, w));
    cloudData.companyWithdrawals.forEach((w) => wdMap.set(w.id, w));
    const mergedWd = Array.from(wdMap.values());
    if (mergedWd.length !== localWd.length || JSON.stringify(mergedWd) !== JSON.stringify(localWd)) {
      saveStoredCompanyWithdrawals(mergedWd);
      hasUpdates = true;
    }
  }

  // 9. Merge & Sync Audit Logs
  if (Array.isArray(cloudData.auditLogs) && cloudData.auditLogs.length > 0) {
    const localLogs = getStoredAuditLogs();
    const logMap = new Map<string, any>();
    localLogs.forEach((l) => logMap.set(l.id, l));
    cloudData.auditLogs.forEach((l) => logMap.set(l.id, l));
    const mergedLogs = Array.from(logMap.values());
    if (mergedLogs.length !== localLogs.length || JSON.stringify(mergedLogs) !== JSON.stringify(localLogs)) {
      saveStoredAuditLogs(mergedLogs);
      hasUpdates = true;
    }
  }

  // 10. Merge & Sync Branches
  if (Array.isArray(cloudData.branches) && cloudData.branches.length > 0) {
    saveStoredBranches(cloudData.branches);
  }

  if (hasUpdates) {
    broadcastRealtimeEvent('MANUAL_SYNC', { source: 'CLOUD_PULL' });
  }

  lastSyncTimestamp = new Date().toLocaleTimeString();
  return true;
};

/**
 * Initializes background cloud synchronization.
 * - Pulls latest state from authoritative cloud backends on app launch and every 1.5s
 * - Pushes to cloud whenever a write event occurs (customers, accounts, approvals, etc.)
 * - Re-syncs immediately on screen focus, tab visibility change, or online event
 */
export const initCloudSync = () => {
  // Initial pull on app launch
  pullCloudToLocal().catch(() => {});

  // Automatically push to cloud relay whenever any staff user, customer, deposit, or account is created locally
  const unsubscribeEvents = subscribeRealtimeEvents((event) => {
    if (event.type !== 'MANUAL_SYNC') {
      pushLocalToCloud().catch(() => {});
    } else {
      pullCloudToLocal().catch(() => {});
    }
  });

  // Fast background poller (every 1.5s) to guarantee zero delay across devices
  const pollTimer = setInterval(() => {
    pullCloudToLocal().catch(() => {});
  }, 1500);

  // Instant sync on screen resume / tab focus
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      pullCloudToLocal().catch(() => {});
    }
  };

  const handleFocus = () => {
    pullCloudToLocal().catch(() => {});
  };

  const handleOnline = () => {
    pullCloudToLocal().catch(() => {});
    pushLocalToCloud().catch(() => {});
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
  }

  return () => {
    unsubscribeEvents();
    clearInterval(pollTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    }
  };
};

/**
 * Generate a quick 6-digit Device Pairing Export String
 */
export const exportPairingBundle = (): string => {
  const users = getRegisteredUsers();
  const bundle = {
    u: users,
    t: Date.now(),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(bundle))));
};

/**
 * Import a Device Pairing Bundle String onto this device
 */
export const importPairingBundle = (encodedBundle: string): boolean => {
  try {
    const raw = decodeURIComponent(escape(atob(encodedBundle.trim())));
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.u) && parsed.u.length > 0) {
      const existing = getRegisteredUsers();
      const userMap = new Map<string, RegisteredUserRecord>();
      existing.forEach((u) => userMap.set(u.email.toLowerCase(), u));
      parsed.u.forEach((u: RegisteredUserRecord) => userMap.set(u.email.toLowerCase(), u));
      const merged = Array.from(userMap.values());
      saveRegisteredUsers(merged);
      pushLocalToCloud().catch(() => {});
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to import pairing bundle', err);
    return false;
  }
};
