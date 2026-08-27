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
  getDeletedCustomerIds,
  addDeletedCustomerId,
  getDeletedUserEmails,
  addDeletedUserEmail,
  RegisteredUserRecord
} from './api';
import { ApprovalRequest } from '../types';
import { broadcastRealtimeEvent, subscribeRealtimeEvents } from './realtimeSync';
import { saveFirestoreVault, subscribeFirestoreVault, isFirebaseConfigured } from './firebase';

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
  deletedCustomerIds?: string[];
  deletedUserEmails?: string[];
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

  // 1. Same-Origin / Vercel Serverless Function Endpoint (Primary)
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    endpoints.push(`${window.location.origin}/api/sync`);
  }

  // 2. Relative Endpoint
  endpoints.push('/api/sync');

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
    deletedCustomerIds: getDeletedCustomerIds(),
    deletedUserEmails: getDeletedUserEmails(),
    updatedAt: new Date().toISOString(),
  };

  const payloadStr = JSON.stringify(payload);
  const endpoints = getSyncEndpoints();
  let anySuccess = false;

  // Write to Firebase Firestore in parallel if configured
  if (isFirebaseConfigured()) {
    saveFirestoreVault(payload).then((ok) => {
      if (ok) anySuccess = true;
    }).catch(() => {});
  }

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

  // Process incoming deleted customer and user tombstones
  if (Array.isArray(cloudData.deletedCustomerIds)) {
    cloudData.deletedCustomerIds.forEach((id) => addDeletedCustomerId(id));
  }
  if (Array.isArray(cloudData.deletedUserEmails)) {
    cloudData.deletedUserEmails.forEach((email) => addDeletedUserEmail(email));
  }
  const deletedCustIds = getDeletedCustomerIds();
  const deletedUserEmails = getDeletedUserEmails();

  // 1. Authoritative Registered Users Sync
  if (Array.isArray(cloudData.registeredUsers)) {
    const localUsers = getRegisteredUsers();
    const cleanUsers = cloudData.registeredUsers.filter((u) => {
      const email = u.email?.toLowerCase();
      return !deletedUserEmails.includes(email) && !deletedUserEmails.includes(u.id?.toLowerCase());
    });

    if (cleanUsers.length !== localUsers.length || JSON.stringify(cleanUsers) !== JSON.stringify(localUsers)) {
      saveRegisteredUsers(cleanUsers);
      hasUpdates = true;
    }
  }

  // 2. Authoritative Approvals Sync
  if (Array.isArray(cloudData.approvals)) {
    const localApprovals = getStoredApprovals();
    const cleanApprovals = cloudData.approvals.filter((a) => {
      const email = a.details?.email?.toLowerCase();
      return !deletedUserEmails.includes(email) && !deletedUserEmails.includes(a.targetId);
    });

    if (cleanApprovals.length !== localApprovals.length || JSON.stringify(cleanApprovals) !== JSON.stringify(localApprovals)) {
      saveStoredApprovals(cleanApprovals);
      hasUpdates = true;
    }
  }

  // 3. Authoritative Customers Sync
  if (Array.isArray(cloudData.customers)) {
    const localCust = getStoredCustomers();
    const cleanCust = cloudData.customers.filter((c) => !deletedCustIds.includes(c.id));
    if (cleanCust.length !== localCust.length || JSON.stringify(cleanCust) !== JSON.stringify(localCust)) {
      saveStoredCustomers(cleanCust);
      hasUpdates = true;
    }
  }

  // 4. Authoritative Accounts Sync
  if (Array.isArray(cloudData.accounts)) {
    const localAcc = getStoredAccounts();
    const cleanAcc = cloudData.accounts.filter(
      (a) => !deletedCustIds.includes(a.customerId) && !deletedCustIds.includes(a.id)
    );
    if (cleanAcc.length !== localAcc.length || JSON.stringify(cleanAcc) !== JSON.stringify(localAcc)) {
      saveStoredAccounts(cleanAcc);
      hasUpdates = true;
    }
  }

  // 5. Authoritative Transactions Sync
  if (Array.isArray(cloudData.transactions)) {
    const localTx = getStoredTransactions();
    if (cloudData.transactions.length !== localTx.length || JSON.stringify(cloudData.transactions) !== JSON.stringify(localTx)) {
      saveStoredTransactions(cloudData.transactions);
      hasUpdates = true;
    }
  }

  // 6. Authoritative Loans Sync
  if (Array.isArray(cloudData.loans)) {
    const localLoans = getStoredLoans();
    const cleanLoans = cloudData.loans.filter((l) => !deletedCustIds.includes(l.customerId));
    if (cleanLoans.length !== localLoans.length || JSON.stringify(cleanLoans) !== JSON.stringify(localLoans)) {
      saveStoredLoans(cleanLoans);
      hasUpdates = true;
    }
  }

  // 7. Authoritative Company Interest Sync
  if (Array.isArray(cloudData.companyInterest)) {
    const localInt = getStoredCompanyInterest();
    if (cloudData.companyInterest.length !== localInt.length || JSON.stringify(cloudData.companyInterest) !== JSON.stringify(localInt)) {
      saveStoredCompanyInterest(cloudData.companyInterest);
      hasUpdates = true;
    }
  }

  // 8. Authoritative Company Withdrawals Sync
  if (Array.isArray(cloudData.companyWithdrawals)) {
    const localWd = getStoredCompanyWithdrawals();
    if (cloudData.companyWithdrawals.length !== localWd.length || JSON.stringify(cloudData.companyWithdrawals) !== JSON.stringify(localWd)) {
      saveStoredCompanyWithdrawals(cloudData.companyWithdrawals);
      hasUpdates = true;
    }
  }

  // 9. Authoritative Audit Logs Sync
  if (Array.isArray(cloudData.auditLogs)) {
    const localLogs = getStoredAuditLogs();
    if (cloudData.auditLogs.length !== localLogs.length || JSON.stringify(cloudData.auditLogs) !== JSON.stringify(localLogs)) {
      saveStoredAuditLogs(cloudData.auditLogs);
      hasUpdates = true;
    }
  }

  if (hasUpdates) {
    broadcastRealtimeEvent('MANUAL_SYNC', { source: 'CLOUD_PULL' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: { type: 'MANUAL_SYNC' } }));
      window.dispatchEvent(new CustomEvent('erikon_cloud_synced', { detail: { timestamp: new Date().toISOString() } }));
    }
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
  pullCloudToLocal().catch(() => { });

  // Automatically push to cloud relay whenever any staff user, customer, deposit, or account is created locally
  const unsubscribeEvents = subscribeRealtimeEvents((event) => {
    if (event.type !== 'MANUAL_SYNC') {
      pushLocalToCloud().catch(() => { });
    } else {
      pullCloudToLocal().catch(() => { });
    }
  });

  // Fast background poller (every 1.5s) to guarantee zero delay across devices
  const pollTimer = setInterval(() => {
    pullCloudToLocal().catch(() => { });
  }, 1500);

  // Instant sync on screen resume / tab focus
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      pullCloudToLocal().catch(() => { });
    }
  };

  const handleFocus = () => {
    pullCloudToLocal().catch(() => { });
  };

  const handleOnline = () => {
    pullCloudToLocal().catch(() => { });
    pushLocalToCloud().catch(() => { });
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
  }

  // Attach live sub-second Firestore onSnapshot listener if configured
  const unsubscribeFirestore = subscribeFirestoreVault((vaultData) => {
    if (vaultData) {
      pullCloudToLocal().catch(() => {});
    }
  });

  return () => {
    unsubscribeEvents();
    unsubscribeFirestore();
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
      pushLocalToCloud().catch(() => { });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to import pairing bundle', err);
    return false;
  }
};
