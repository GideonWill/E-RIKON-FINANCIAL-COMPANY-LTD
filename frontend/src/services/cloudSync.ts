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
  getStoredApprovals,
  saveStoredApprovals,
  RegisteredUserRecord
} from './api';
import { broadcastRealtimeEvent, subscribeRealtimeEvents } from './realtimeSync';

// Cloud Relay Storage Endpoint (Vercel Serverless API + Global Cloud KV Fallback)
const LOCAL_API_SYNC_URL = '/api/sync';
const PUBLIC_CLOUD_RELAY_KEY = 'erikon_ecfms_live_vault_v1';
const PUBLIC_CLOUD_KV_URL = `https://kvdb.io/4y9hN9K5uV8t3M9P/${PUBLIC_CLOUD_RELAY_KEY}`;

export interface CloudVaultPayload {
  registeredUsers?: RegisteredUserRecord[];
  customers?: any[];
  accounts?: any[];
  transactions?: any[];
  loans?: any[];
  companyInterest?: any[];
  approvals?: any[];
  updatedAt?: string;
}

let isSyncing = false;
let lastSyncTimestamp: string | null = null;

export const getLastSyncTime = () => lastSyncTimestamp;

/**
 * Pushes all local storage state to the cloud relay
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
    approvals: getStoredApprovals(),
    updatedAt: new Date().toISOString(),
  };

  let success = false;

  // 1. Try Vercel Serverless /api/sync endpoint
  try {
    const res = await fetch(LOCAL_API_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      success = true;
    }
  } catch {
    // Failover to public cloud KV
  }

  // 2. Also push to resilient cloud KV relay
  try {
    await fetch(PUBLIC_CLOUD_KV_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    success = true;
  } catch (e) {
    console.warn('Cloud KV push skipped or failed', e);
  }

  lastSyncTimestamp = new Date().toLocaleTimeString();
  isSyncing = false;
  return success;
};

/**
 * Pulls latest state from cloud relay and merges into local storage
 */
export const pullCloudToLocal = async (): Promise<boolean> => {
  let cloudData: CloudVaultPayload | null = null;

  // 1. Try Vercel Serverless /api/sync endpoint
  try {
    const res = await fetch(LOCAL_API_SYNC_URL);
    if (res.ok) {
      const json = await res.json();
      if (json && json.vault) {
        cloudData = json.vault;
      }
    }
  } catch {
    // Fallback to cloud KV
  }

  // 2. If not found or empty, try public cloud KV relay
  if (!cloudData || !cloudData.registeredUsers || cloudData.registeredUsers.length === 0) {
    try {
      const kvRes = await fetch(PUBLIC_CLOUD_KV_URL);
      if (kvRes.ok) {
        cloudData = await kvRes.json();
      }
    } catch (e) {
      console.warn('Cloud KV pull error', e);
    }
  }

  if (!cloudData) return false;

  let hasUpdates = false;

  // Merge Registered Users
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

  // Merge Customers
  if (Array.isArray(cloudData.customers) && cloudData.customers.length > 0) {
    const localCust = getStoredCustomers();
    const custMap = new Map<string, any>();
    localCust.forEach(c => custMap.set(c.id, c));
    cloudData.customers.forEach(c => custMap.set(c.id, c));
    const mergedCust = Array.from(custMap.values());
    if (mergedCust.length !== localCust.length) {
      saveStoredCustomers(mergedCust);
      hasUpdates = true;
    }
  }

  // Merge Accounts
  if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
    const localAcc = getStoredAccounts();
    const accMap = new Map<string, any>();
    localAcc.forEach(a => accMap.set(a.id, a));
    cloudData.accounts.forEach(a => accMap.set(a.id, a));
    const mergedAcc = Array.from(accMap.values());
    if (mergedAcc.length !== localAcc.length) {
      saveStoredAccounts(mergedAcc);
      hasUpdates = true;
    }
  }

  // Merge Transactions
  if (Array.isArray(cloudData.transactions) && cloudData.transactions.length > 0) {
    const localTx = getStoredTransactions();
    const txMap = new Map<string, any>();
    localTx.forEach(t => txMap.set(t.id, t));
    cloudData.transactions.forEach(t => txMap.set(t.id, t));
    const mergedTx = Array.from(txMap.values());
    if (mergedTx.length !== localTx.length) {
      saveStoredTransactions(mergedTx);
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
 * Initializes automatic background cloud synchronization
 */
export const initCloudSync = () => {
  // Initial pull on app launch
  pullCloudToLocal().catch(() => {});

  // Automatically push to cloud relay whenever any staff user, customer, deposit, or account is created
  const unsubscribeEvents = subscribeRealtimeEvents((event) => {
    if (event.type !== 'MANUAL_SYNC') {
      pushLocalToCloud().catch(() => {});
    }
  });

  // Periodic heartbeat sync every 4 seconds to pull updates from other devices
  const intervalId = setInterval(() => {
    pullCloudToLocal().catch(() => {});
  }, 4000);

  return () => {
    unsubscribeEvents();
    clearInterval(intervalId);
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
