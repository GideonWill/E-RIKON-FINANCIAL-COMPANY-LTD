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
import { 
  getFirestoreVault,
  saveFirestoreVault, 
  subscribeFirestoreVault, 
  isFirebaseConfigured 
} from './firebase';

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

  // 1. Authoritative Production Backend Endpoint
  endpoints.push('https://e-rikon-ecfms-backend.onrender.com/api/sync');

  // 2. Same-Origin / Vercel Serverless Function Endpoint (Primary)
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    endpoints.push(`${window.location.origin}/api/sync`);
  }

  // 3. Relative Endpoint
  endpoints.push('/api/sync');

  // 4. Localhost Dev Backend (if running locally)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    endpoints.push('http://localhost:4000/api/sync');
  }

  // 5. Custom Environment API URL
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
 * Applies an incoming cloud vault payload to local storage and dispatches update events
 */
export const applyIncomingCloudVault = (cloudData: CloudVaultPayload): boolean => {
  if (!cloudData) return false;

  let hasUpdates = false;

  // Process incoming deleted customer and user tombstones
  if (Array.isArray(cloudData.deletedCustomerIds)) {
    cloudData.deletedCustomerIds.forEach((id) => {
      if (id) addDeletedCustomerId(id);
    });
  }
  if (Array.isArray(cloudData.deletedUserEmails)) {
    cloudData.deletedUserEmails.forEach((email) => {
      if (email) addDeletedUserEmail(email);
    });
  }
  const deletedCustIds = getDeletedCustomerIds();
  const deletedUserEmails = (getDeletedUserEmails() || []).map((e) => e.toLowerCase());

  // 1. Authoritative Registered Users Sync (Strictly purge any deleted users)
  if (Array.isArray(cloudData.registeredUsers)) {
    const cleanUsers = cloudData.registeredUsers.filter(
      (u) => !deletedUserEmails.includes((u.email || '').toLowerCase()) && 
             !deletedUserEmails.includes((u.id || '').toLowerCase())
    );
    const localUsers = getRegisteredUsers().filter(
      (u) => !deletedUserEmails.includes((u.email || '').toLowerCase()) && 
             !deletedUserEmails.includes((u.id || '').toLowerCase())
    );

    if (JSON.stringify(cleanUsers) !== JSON.stringify(localUsers)) {
      saveRegisteredUsers(cleanUsers);
      hasUpdates = true;
    }
  }

  // 2. Authoritative Approvals Sync
  if (Array.isArray(cloudData.approvals)) {
    const cleanCloudApprovals = cloudData.approvals.filter(
      (a) => !deletedCustIds.includes(a.targetId || '') && 
             !deletedUserEmails.includes((a.targetId || '').toLowerCase()) &&
             !deletedUserEmails.includes((a.details?.email || '').toLowerCase())
    );
    const localApprovals = getStoredApprovals().filter(
      (a) => !deletedCustIds.includes(a.targetId || '') && 
             !deletedUserEmails.includes((a.targetId || '').toLowerCase()) &&
             !deletedUserEmails.includes((a.details?.email || '').toLowerCase())
    );

    const apprMap = new Map<string, any>();
    localApprovals.forEach((a) => apprMap.set(a.id, a));
    cleanCloudApprovals.forEach((a) => {
      const existing = apprMap.get(a.id);
      // If local already resolved (APPROVED / REJECTED) and incoming is PENDING, keep local decision!
      if (existing && (existing.status === 'APPROVED' || existing.status === 'REJECTED') && a.status === 'PENDING') {
        apprMap.set(a.id, existing);
      } else {
        apprMap.set(a.id, { ...existing, ...a });
      }
    });

    const mergedApprovals = Array.from(apprMap.values()).filter(
      (a) => !deletedCustIds.includes(a.targetId || '') && 
             !deletedUserEmails.includes((a.targetId || '').toLowerCase()) &&
             !deletedUserEmails.includes((a.details?.email || '').toLowerCase())
    );

    if (JSON.stringify(mergedApprovals) !== JSON.stringify(localApprovals)) {
      saveStoredApprovals(mergedApprovals);
      hasUpdates = true;
    }
  }

  // 3. Merged Authoritative Customers Sync (Strictly purge deleted customers across devices)
  if (Array.isArray(cloudData.customers)) {
    const cleanCloudCust = cloudData.customers.filter(
      (c) => !deletedCustIds.includes(c.id) && !deletedCustIds.includes(c.customerNumber)
    );
    const localCust = getStoredCustomers().filter(
      (c) => !deletedCustIds.includes(c.id) && !deletedCustIds.includes(c.customerNumber)
    );

    if (JSON.stringify(cleanCloudCust) !== JSON.stringify(localCust)) {
      saveStoredCustomers(cleanCloudCust);
      hasUpdates = true;
    }
  }

  // 4. Merged Authoritative Accounts Sync
  if (Array.isArray(cloudData.accounts)) {
    const cleanCloudAcc = cloudData.accounts.filter(
      (a) => !deletedCustIds.includes(a.customerId) && !deletedCustIds.includes(a.id)
    );
    const localAcc = getStoredAccounts().filter(
      (a) => !deletedCustIds.includes(a.customerId) && !deletedCustIds.includes(a.id)
    );

    if (JSON.stringify(cleanCloudAcc) !== JSON.stringify(localAcc)) {
      saveStoredAccounts(cleanCloudAcc);
      hasUpdates = true;
    }
  }

  // 5. Merged Authoritative Transactions Sync
  if (Array.isArray(cloudData.transactions)) {
    const localTx = getStoredTransactions();
    const txMap = new Map<string, any>();
    localTx.forEach((t) => {
      if (t.id) txMap.set(t.id, t);
      if (t.referenceNo) txMap.set(t.referenceNo, t);
    });
    cloudData.transactions.forEach((t) => {
      const existing = txMap.get(t.id) || (t.referenceNo ? txMap.get(t.referenceNo) : null);
      txMap.set(t.id, { ...existing, ...t });
    });

    const mergedTx = Array.from(new Set(Array.from(txMap.values()).map((t) => t.id)))
      .map((id) => txMap.get(id)!);

    if (mergedTx.length !== localTx.length || JSON.stringify(mergedTx) !== JSON.stringify(localTx)) {
      saveStoredTransactions(mergedTx);
      hasUpdates = true;
    }
  }

  // 6. Merged Authoritative Loans Sync
  if (Array.isArray(cloudData.loans)) {
    const cleanLoans = cloudData.loans.filter(
      (l) => !deletedCustIds.includes(l.customerId) && !deletedCustIds.includes(l.id)
    );
    const localLoans = getStoredLoans().filter(
      (l) => !deletedCustIds.includes(l.customerId) && !deletedCustIds.includes(l.id)
    );

    if (JSON.stringify(cleanLoans) !== JSON.stringify(localLoans)) {
      saveStoredLoans(cleanLoans);
      hasUpdates = true;
    }
  }

  // 7. Merged Authoritative Company Interest Sync (Keyed by client cycle)
  if (Array.isArray(cloudData.companyInterest)) {
    const localInt = getStoredCompanyInterest();
    const intMap = new Map<string, any>();
    localInt.forEach((i) => {
      const key = `${i.accountNumber || i.accountId || i.customerId}-cyc-${i.cycleNumber}`;
      intMap.set(key, i);
    });
    cloudData.companyInterest.forEach((i) => {
      const key = `${i.accountNumber || i.accountId || i.customerId}-cyc-${i.cycleNumber}`;
      const existing = intMap.get(key);
      intMap.set(key, { ...existing, ...i });
    });

    const mergedInt = Array.from(intMap.values());
    if (mergedInt.length !== localInt.length || JSON.stringify(mergedInt) !== JSON.stringify(localInt)) {
      saveStoredCompanyInterest(mergedInt);
      hasUpdates = true;
    }
  }

  // 8. Merged Authoritative Company Withdrawals Sync
  if (Array.isArray(cloudData.companyWithdrawals)) {
    const localWd = getStoredCompanyWithdrawals();
    const wdMap = new Map<string, any>();
    localWd.forEach((w) => {
      if (w.id) wdMap.set(w.id, w);
    });
    cloudData.companyWithdrawals.forEach((w) => {
      const existing = wdMap.get(w.id);
      if (existing && (existing.status === 'APPROVED' || existing.status === 'REJECTED') && w.status === 'PENDING_SUPER_ADMIN_APPROVAL') {
        wdMap.set(w.id, existing);
      } else {
        wdMap.set(w.id, { ...existing, ...w });
      }
    });

    const mergedWd = Array.from(wdMap.values());
    if (mergedWd.length !== localWd.length || JSON.stringify(mergedWd) !== JSON.stringify(localWd)) {
      saveStoredCompanyWithdrawals(mergedWd);
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
 * Pulls latest state from authoritative cloud backends and merges into local storage
 */
export const pullCloudToLocal = async (): Promise<boolean> => {
  // 1. Try direct Firestore read first if configured
  if (isFirebaseConfigured()) {
    try {
      const firestoreData = await getFirestoreVault();
      if (
        firestoreData &&
        ((Array.isArray(firestoreData.registeredUsers) && firestoreData.registeredUsers.length > 0) ||
         (Array.isArray(firestoreData.customers) && firestoreData.customers.length > 0) ||
         (Array.isArray(firestoreData.transactions) && firestoreData.transactions.length > 0))
      ) {
        return applyIncomingCloudVault(firestoreData);
      }
    } catch {}
  }

  // 2. Fallback to HTTP sync endpoints
  const endpoints = getSyncEndpoints();
  let cloudData: CloudVaultPayload | null = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
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
          ((Array.isArray(vault.registeredUsers) && vault.registeredUsers.length > 0) ||
           (Array.isArray(vault.customers) && vault.customers.length > 0) ||
           (Array.isArray(vault.transactions) && vault.transactions.length > 0))
        ) {
          cloudData = vault;
          break;
        } else if (vault && !cloudData) {
          cloudData = vault;
        }
      }
    } catch (e) {}
  }

  if (!cloudData) return false;
  return applyIncomingCloudVault(cloudData);
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
      applyIncomingCloudVault(vaultData);
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
