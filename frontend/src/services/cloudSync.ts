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
  RegisteredUserRecord,
  apiClient
} from './api';
import { broadcastRealtimeEvent, subscribeRealtimeEvents } from './realtimeSync';

// Cloud Relay Storage Endpoint (Live NestJS / Render Backend + Global Cloud KV Fallback)
const PUBLIC_CLOUD_RELAY_KEY = 'erikon_ecfms_live_vault_v1';
const PUBLIC_CLOUD_KV_URL = `https://kvdb.io/4y9hN9K5uV8t3M9P/${PUBLIC_CLOUD_RELAY_KEY}`;

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

let isSyncing = false;
let lastSyncTimestamp: string | null = null;

export const getLastSyncTime = () => lastSyncTimestamp;

/**
 * Pushes all local storage state to the central cloud backend and KV relay
 */
export const pushLocalToCloud = async (): Promise<boolean> => {
  if (isSyncing) return false;
  isSyncing = true;

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

  let success = false;

  // 1. Primary: Push directly to Live NestJS /sync API endpoint
  try {
    const { data } = await apiClient.post('/sync', payload);
    if (data && data.success) {
      success = true;
    }
  } catch (err: any) {
    console.warn('[Sync] Live backend /sync push error:', err?.message || err);
  }

  // 2. Secondary: Push to resilient public cloud KV relay
  try {
    await fetch(PUBLIC_CLOUD_KV_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    success = true;
  } catch (e) {
    // Cloud KV fallback
  }

  lastSyncTimestamp = new Date().toLocaleTimeString();
  isSyncing = false;
  return success;
};

/**
 * Pulls latest state from authoritative cloud backend and merges into local storage
 */
export const pullCloudToLocal = async (): Promise<boolean> => {
  let cloudData: CloudVaultPayload | null = null;

  // 1. Primary: Fetch from Live NestJS /sync API endpoint
  try {
    const { data } = await apiClient.get('/sync');
    if (data && data.vault) {
      cloudData = data.vault;
    }
  } catch (err: any) {
    // Fallback to KV
  }

  // 2. Secondary: If not found or empty, pull from public cloud KV relay
  if (!cloudData || (!cloudData.registeredUsers?.length && !cloudData.customers?.length && !cloudData.accounts?.length)) {
    try {
      const kvRes = await fetch(PUBLIC_CLOUD_KV_URL);
      if (kvRes.ok) {
        cloudData = await kvRes.json();
      }
    } catch (e) {
      // Offline fallback
    }
  }

  if (!cloudData) return false;

  let hasUpdates = false;

  // Merge & Sync Registered Users
  if (Array.isArray(cloudData.registeredUsers) && cloudData.registeredUsers.length > 0) {
    const localUsers = getRegisteredUsers();
    const userMap = new Map<string, RegisteredUserRecord>();
    localUsers.forEach(u => userMap.set(u.email.toLowerCase(), u));
    cloudData.registeredUsers.forEach(u => userMap.set(u.email.toLowerCase(), u));
    const mergedUsers = Array.from(userMap.values());
    if (mergedUsers.length !== localUsers.length || JSON.stringify(mergedUsers) !== JSON.stringify(localUsers)) {
      saveRegisteredUsers(mergedUsers);
      hasUpdates = true;
    }
  }

  // Merge & Sync Customers
  if (Array.isArray(cloudData.customers) && cloudData.customers.length > 0) {
    const localCust = getStoredCustomers();
    const custMap = new Map<string, any>();
    localCust.forEach(c => custMap.set(c.id, c));
    cloudData.customers.forEach(c => custMap.set(c.id, c));
    const mergedCust = Array.from(custMap.values());
    if (mergedCust.length !== localCust.length || JSON.stringify(mergedCust) !== JSON.stringify(localCust)) {
      saveStoredCustomers(mergedCust);
      hasUpdates = true;
    }
  }

  // Merge & Sync Accounts
  if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
    const localAcc = getStoredAccounts();
    const accMap = new Map<string, any>();
    localAcc.forEach(a => accMap.set(a.id, a));
    cloudData.accounts.forEach(a => accMap.set(a.id, a));
    const mergedAcc = Array.from(accMap.values());
    if (mergedAcc.length !== localAcc.length || JSON.stringify(mergedAcc) !== JSON.stringify(localAcc)) {
      saveStoredAccounts(mergedAcc);
      hasUpdates = true;
    }
  }

  // Merge & Sync Transactions
  if (Array.isArray(cloudData.transactions) && cloudData.transactions.length > 0) {
    const localTx = getStoredTransactions();
    const txMap = new Map<string, any>();
    localTx.forEach(t => txMap.set(t.id, t));
    cloudData.transactions.forEach(t => txMap.set(t.id, t));
    const mergedTx = Array.from(txMap.values());
    if (mergedTx.length !== localTx.length || JSON.stringify(mergedTx) !== JSON.stringify(localTx)) {
      saveStoredTransactions(mergedTx);
      hasUpdates = true;
    }
  }

  // Merge & Sync Approvals
  if (Array.isArray(cloudData.approvals) && cloudData.approvals.length > 0) {
    const localAppr = getStoredApprovals();
    const apprMap = new Map<string, any>();
    localAppr.forEach(a => apprMap.set(a.id, a));
    cloudData.approvals.forEach(a => apprMap.set(a.id, a));
    const mergedAppr = Array.from(apprMap.values());
    if (mergedAppr.length !== localAppr.length || JSON.stringify(mergedAppr) !== JSON.stringify(localAppr)) {
      saveStoredApprovals(mergedAppr);
      hasUpdates = true;
    }
  }

  // Merge & Sync Loans
  if (Array.isArray(cloudData.loans) && cloudData.loans.length > 0) {
    const localLoans = getStoredLoans();
    const loanMap = new Map<string, any>();
    localLoans.forEach(l => loanMap.set(l.id, l));
    cloudData.loans.forEach(l => loanMap.set(l.id, l));
    const mergedLoans = Array.from(loanMap.values());
    if (mergedLoans.length !== localLoans.length || JSON.stringify(mergedLoans) !== JSON.stringify(localLoans)) {
      saveStoredLoans(mergedLoans);
      hasUpdates = true;
    }
  }

  // Merge & Sync Company Interest
  if (Array.isArray(cloudData.companyInterest) && cloudData.companyInterest.length > 0) {
    const localInt = getStoredCompanyInterest();
    const intMap = new Map<string, any>();
    localInt.forEach(i => intMap.set(i.id, i));
    cloudData.companyInterest.forEach(i => intMap.set(i.id, i));
    const mergedInt = Array.from(intMap.values());
    if (mergedInt.length !== localInt.length || JSON.stringify(mergedInt) !== JSON.stringify(localInt)) {
      saveStoredCompanyInterest(mergedInt);
      hasUpdates = true;
    }
  }

  // Merge & Sync Company Withdrawals
  if (Array.isArray(cloudData.companyWithdrawals) && cloudData.companyWithdrawals.length > 0) {
    const localWd = getStoredCompanyWithdrawals();
    const wdMap = new Map<string, any>();
    localWd.forEach(w => wdMap.set(w.id, w));
    cloudData.companyWithdrawals.forEach(w => wdMap.set(w.id, w));
    const mergedWd = Array.from(wdMap.values());
    if (mergedWd.length !== localWd.length || JSON.stringify(mergedWd) !== JSON.stringify(localWd)) {
      saveStoredCompanyWithdrawals(mergedWd);
      hasUpdates = true;
    }
  }

  if (hasUpdates) {
    broadcastRealtimeEvent('MANUAL_SYNC', { source: 'CLOUD_PULL' });
  }

  lastSyncTimestamp = new Date().toLocaleTimeString();
  return true;
};

/**
 * Initializes background cloud synchronization.
 * - Pulls latest state from authoritative cloud backend on app launch and every 2.5s
 * - Pushes to cloud whenever a write event occurs (customers, accounts, approvals, etc.)
 * - Re-syncs immediately on screen focus or tab visibility change
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

  // Fast background poller (every 2.5s) to guarantee zero delay between laptop and mobile
  const pollTimer = setInterval(() => {
    pullCloudToLocal().catch(() => {});
  }, 2500);

  // Instant sync on screen resume / tab focus
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      pullCloudToLocal().catch(() => {});
    }
  };

  const handleFocus = () => {
    pullCloudToLocal().catch(() => {});
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
  }

  return () => {
    unsubscribeEvents();
    clearInterval(pollTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
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
      existing.forEach(u => userMap.set(u.email.toLowerCase(), u));
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
