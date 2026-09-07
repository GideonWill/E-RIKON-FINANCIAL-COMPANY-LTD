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
  getRealtimeDatabaseVault,
  saveRealtimeDatabaseVault, 
  subscribeRealtimeDatabaseVault, 
  isFirebaseConfigured,
  isRealtimeCloudConnected
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
  authoritative?: boolean;
  action?: string;
  updatedAt?: string;
}

let isPushing = false;
let pushPending = false;
let isApplyingRemoteUpdate = false;
let lastSyncTimestamp: string | null = null;

export const getLastSyncTime = () => lastSyncTimestamp;
export const isRemoteSyncInProgress = () => isApplyingRemoteUpdate;

/**
 * Returns all active cloud sync endpoints in priority order (HTTP fallback)
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
 * Pushes all local storage state to Firebase Realtime Database and HTTP endpoints.
 * Guards against pushing during remote updates to eliminate echo loops.
 */
export const pushLocalToCloud = async (authoritative = true): Promise<boolean> => {
  if (isApplyingRemoteUpdate) {
    return false;
  }

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
    authoritative,
    updatedAt: new Date().toISOString(),
  };

  let anySuccess = false;

  // 1. Primary: Write to Google Firebase Realtime Database (<30ms global WebSocket relay)
  if (isFirebaseConfigured()) {
    try {
      const ok = await saveRealtimeDatabaseVault(payload);
      if (ok) anySuccess = true;
    } catch (e) {
      console.warn('[CloudSync] Firebase RTDB write error:', e);
    }
  }

  // 2. Secondary: Asynchronous background push to HTTP endpoints (non-blocking)
  const payloadStr = JSON.stringify(payload);
  const endpoints = getSyncEndpoints();

  endpoints.forEach((url) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
        signal: controller.signal,
      }).then((res) => {
        clearTimeout(timeoutId);
        if (res.ok) anySuccess = true;
      }).catch(() => {});
    } catch {}
  });

  lastSyncTimestamp = new Date().toLocaleTimeString();
  isPushing = false;

  if (pushPending) {
    setTimeout(() => pushLocalToCloud(authoritative), 150);
  }

  return anySuccess;
};

/**
 * Applies an incoming cloud vault payload to local storage and dispatches update events.
 * Uses isApplyingRemoteUpdate guard to prevent infinite echo loops.
 */
export const applyIncomingCloudVault = (cloudData: CloudVaultPayload): boolean => {
  if (!cloudData) return false;

  isApplyingRemoteUpdate = true;
  let hasUpdates = false;

  try {
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

    // 1. Authoritative Registered Users Sync (Lossless Merge)
    if (Array.isArray(cloudData.registeredUsers)) {
      const cleanUsers = cloudData.registeredUsers.filter(
        (u) => !deletedUserEmails.includes((u.email || '').toLowerCase()) && 
               !deletedUserEmails.includes((u.id || '').toLowerCase())
      );
      const localUsers = getRegisteredUsers().filter(
        (u) => !deletedUserEmails.includes((u.email || '').toLowerCase()) && 
               !deletedUserEmails.includes((u.id || '').toLowerCase())
      );

      const userMap = new Map<string, RegisteredUserRecord>();
      localUsers.forEach((u) => {
        const key = (u.email || u.id || '').toLowerCase();
        if (key) userMap.set(key, u);
      });
      cleanUsers.forEach((u) => {
        const key = (u.email || u.id || '').toLowerCase();
        if (key) {
          const existing = userMap.get(key);
          userMap.set(key, { ...existing, ...u });
        }
      });

      const mergedUsers = Array.from(userMap.values()).filter(
        (u) => !deletedUserEmails.includes((u.email || '').toLowerCase()) && 
               !deletedUserEmails.includes((u.id || '').toLowerCase())
      );

      if (JSON.stringify(mergedUsers) !== JSON.stringify(localUsers)) {
        saveRegisteredUsers(mergedUsers);
        hasUpdates = true;
      }
    }

    // 2. Authoritative Approvals Sync (Lossless Merge)
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

    const sanitizeVincentAcc = (acc: any) => {
      const name = `${acc.customer?.firstName || ''} ${acc.customer?.lastName || ''}`.toLowerCase();
      const isVincent = name.includes('vincent') || name.includes('mensah') || acc.id === 'acc-vkm' || acc.accountNumber?.includes('VKM');
      if (isVincent) {
        if (acc.dailyCycles && acc.dailyCycles.length > 5) {
          acc.dailyCycles = acc.dailyCycles.filter((c: any) => c.cycleNumber <= 5);
        }
        if (acc.currentBalance > 1350) {
          acc.currentBalance = 1350;
          acc.availableBalance = 1310;
        }
      }
      return acc;
    };

    const isVincentTxItem = (t: any) => {
      const name = `${t.account?.customer?.firstName || ''} ${t.account?.customer?.lastName || ''} ${t.customer?.firstName || ''} ${t.customer?.lastName || ''}`.toLowerCase();
      return name.includes('vincent') || name.includes('mensah') || t.accountId === 'acc-vkm' || t.account?.accountNumber?.includes('VKM');
    };

    // Authoritative direct replacement (clears any stale test transactions or old deleted records)
    if (cloudData.authoritative) {
      if (Array.isArray(cloudData.customers)) {
        saveStoredCustomers(cloudData.customers, true);
      }
      if (Array.isArray(cloudData.accounts)) {
        saveStoredAccounts(cloudData.accounts.map(sanitizeVincentAcc));
      }
      if (Array.isArray(cloudData.transactions)) {
        const cleanTxs = cloudData.transactions.filter((t: any) => {
          if (isVincentTxItem(t) && t.type === 'DEPOSIT') {
            return t.referenceNo?.startsWith('TX-DEP-vkm-dep');
          }
          return true;
        });
        saveStoredTransactions(cleanTxs);
      }
      saveStoredLoans(Array.isArray(cloudData.loans) ? cloudData.loans : []);
      if (Array.isArray(cloudData.companyInterest)) {
        const cleanInterest = cloudData.companyInterest.filter((ci: any) => {
          const isVincent = ci.customerName === 'Vincent Kwabena Mensah' || ci.id?.startsWith('ci-vkm');
          if (isVincent && ci.cycleNumber > 4) return false;
          return true;
        });
        saveStoredCompanyInterest(cleanInterest);
      }
      saveStoredCompanyWithdrawals(Array.isArray(cloudData.companyWithdrawals) ? cloudData.companyWithdrawals : []);
      if (Array.isArray(cloudData.approvals)) {
        const cleanCloudApprovals = cloudData.approvals.filter(
          (a) => !deletedCustIds.includes(a.targetId || '') && 
                 !deletedUserEmails.includes((a.targetId || '').toLowerCase()) &&
                 !deletedUserEmails.includes((a.details?.email || '').toLowerCase())
        );
        saveStoredApprovals(cleanCloudApprovals);
      }
      if (Array.isArray(cloudData.auditLogs)) {
        saveStoredAuditLogs(cloudData.auditLogs);
      }
      localStorage.setItem('erikon_dynamic_notifications', JSON.stringify([]));
      localStorage.setItem('erikon_read_notifications', JSON.stringify([]));
      localStorage.setItem('erikon_cleared_notifications', JSON.stringify([]));

      broadcastRealtimeEvent('MANUAL_SYNC', { source: 'REMOTE_CLOUD_AUTHORITATIVE' }, 'remote');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: { type: 'MANUAL_SYNC', origin: 'remote' } }));
        window.dispatchEvent(new CustomEvent('erikon_cloud_synced', { detail: { timestamp: new Date().toISOString() } }));
      }
      lastSyncTimestamp = new Date().toLocaleTimeString();
      return true;
    }

    // 3. Merged Customers Sync
    let cleanCloudCust: any[] = [];
    if (Array.isArray(cloudData.customers)) {
      cleanCloudCust = cloudData.customers.filter(
        (c) => !deletedCustIds.includes(c.id) && !deletedCustIds.includes(c.customerNumber)
      );
    }

    // Auto-harvest customers embedded in accounts only
    if (Array.isArray(cloudData.accounts)) {
      cloudData.accounts.forEach((acc: any) => {
        if (acc.customer && acc.customer.id && !deletedCustIds.includes(acc.customer.id)) {
          if (!cleanCloudCust.some((c) => c.id === acc.customer.id || c.customerNumber === acc.customer.customerNumber)) {
            const { accounts: _, ...cleanCust } = acc.customer;
            cleanCloudCust.push(cleanCust);
          }
        }
      });
    }

    const localCust = getStoredCustomers().filter(
      (c) => !deletedCustIds.includes(c.id) && !deletedCustIds.includes(c.customerNumber)
    );

    const custMap = new Map<string, any>();
    const custNoToId = new Map<string, string>();

    localCust.forEach((c) => {
      if (!c || !c.id) return;
      custMap.set(c.id, c);
      if (c.customerNumber) custNoToId.set(c.customerNumber, c.id);
    });

    cleanCloudCust.forEach((c) => {
      if (!c || !c.id) return;
      const matchedId =
        (c.id && custMap.has(c.id) ? c.id : undefined) ||
        (c.customerNumber && custNoToId.get(c.customerNumber)) ||
        c.id;

      const existing = custMap.get(matchedId);
      const targetId = existing?.id || c.id;
      const mergedRecord = { ...existing, ...c, id: targetId };

      custMap.set(targetId, mergedRecord);
      if (mergedRecord.customerNumber) custNoToId.set(mergedRecord.customerNumber, targetId);
    });

    const seenIds = new Set<string>();
    const seenCustNos = new Set<string>();
    const mergedCust: any[] = [];

    // Allow multiple accounts and clients to share the same Ghana card
    for (const c of custMap.values()) {
      if (!c || !c.id) continue;
      if (deletedCustIds.includes(c.id) || (c.customerNumber && deletedCustIds.includes(c.customerNumber))) continue;
      if (seenIds.has(c.id)) continue;
      if (c.customerNumber && seenCustNos.has(c.customerNumber)) continue;

      seenIds.add(c.id);
      if (c.customerNumber) seenCustNos.add(c.customerNumber);
      mergedCust.push(c);
    }

    if (JSON.stringify(mergedCust) !== JSON.stringify(localCust)) {
      saveStoredCustomers(mergedCust, true);
      hasUpdates = true;
    }

    // 4. Merged Authoritative Transactions Sync
    if (Array.isArray(cloudData.transactions)) {
      const localTxs = getStoredTransactions();
      const txMap = new Map<string, any>();
      localTxs.forEach((t) => {
        const key = t.receiptNo || t.id;
        if (key) txMap.set(key, t);
      });
      cloudData.transactions.forEach((t) => {
        const key = t.receiptNo || t.id;
        if (key) {
          const existing = txMap.get(key);
          txMap.set(key, { ...existing, ...t });
        }
      });

      const mergedTxs = Array.from(txMap.values()).filter((t) => {
        if (deletedCustIds.includes(t.id) || (t.receiptNo && deletedCustIds.includes(t.receiptNo))) return false;
        const txCustId = t.customerId || t.account?.customerId || t.account?.customer?.id;
        const txCustNo = t.customer?.customerNumber || t.account?.customer?.customerNumber;
        if (txCustId && deletedCustIds.includes(txCustId)) return false;
        if (txCustNo && deletedCustIds.includes(txCustNo)) return false;
        if (isVincentTxItem(t) && t.type === 'DEPOSIT') {
          return t.referenceNo?.startsWith('TX-DEP-vkm-dep');
        }
        return true;
      });

      if (JSON.stringify(mergedTxs) !== JSON.stringify(localTxs)) {
        saveStoredTransactions(mergedTxs, true);
        hasUpdates = true;
      }
    }

    // 5. Merged Authoritative Accounts Sync
    if (Array.isArray(cloudData.accounts)) {
      const localAcc = getStoredAccounts();
      const accMap = new Map<string, any>();
      localAcc.forEach((a) => {
        const key = a.accountNumber || a.id;
        if (key) accMap.set(key, a);
      });
      cloudData.accounts.forEach((a) => {
        const key = a.accountNumber || a.id;
        if (key) {
          const existing = accMap.get(key);
          const mergedAcc = { ...existing, ...a };
          // Preserve cycles if incoming cycles are missing
          if (existing?.dailyCycles && (!a.dailyCycles || a.dailyCycles.length === 0)) {
            mergedAcc.dailyCycles = existing.dailyCycles;
          }
          accMap.set(key, mergedAcc);
        }
      });

      const mergedAcc = Array.from(accMap.values()).map(sanitizeVincentAcc).filter(
        (a) =>
          !deletedCustIds.includes(a.customerId) &&
          !deletedCustIds.includes(a.id) &&
          (!a.customer?.id || !deletedCustIds.includes(a.customer.id)) &&
          (!a.customer?.customerNumber || !deletedCustIds.includes(a.customer.customerNumber))
      );

      if (JSON.stringify(mergedAcc) !== JSON.stringify(localAcc)) {
        saveStoredAccounts(mergedAcc, true);
        hasUpdates = true;
      }
    }

    // 6. Merged Authoritative Loans Sync
    if (Array.isArray(cloudData.loans)) {
      const localLoans = getStoredLoans();
      const loanMap = new Map<string, any>();
      localLoans.forEach((l) => {
        if (l.id) loanMap.set(l.id, l);
      });
      cloudData.loans.forEach((l) => {
        const existing = loanMap.get(l.id);
        loanMap.set(l.id, { ...existing, ...l });
      });

      const mergedLoans = Array.from(loanMap.values()).filter(
        (l) =>
          !deletedCustIds.includes(l.customerId) &&
          !deletedCustIds.includes(l.id) &&
          (!l.customer?.id || !deletedCustIds.includes(l.customer.id)) &&
          (!l.customer?.customerNumber || !deletedCustIds.includes(l.customer.customerNumber))
      );

      if (JSON.stringify(mergedLoans) !== JSON.stringify(localLoans)) {
        saveStoredLoans(mergedLoans, true);
        hasUpdates = true;
      }
    }

    // 7. Merged Authoritative Company Interest Sync
    if (Array.isArray(cloudData.companyInterest)) {
      const sanitizedInterest = cloudData.companyInterest.filter((ci: any) => {
        const isVincent = ci.customerName === 'Vincent Kwabena Mensah' || ci.id?.startsWith('ci-vkm');
        if (isVincent && ci.cycleNumber > 4) return false;
        return true;
      });
      const localInt = getStoredCompanyInterest();
      if (JSON.stringify(sanitizedInterest) !== JSON.stringify(localInt)) {
        saveStoredCompanyInterest(sanitizedInterest);
        hasUpdates = true;
      }
    }

    // 8. Merged Authoritative Company Withdrawals Sync
    if (Array.isArray(cloudData.companyWithdrawals)) {
      const localWd = getStoredCompanyWithdrawals();
      if (JSON.stringify(cloudData.companyWithdrawals) !== JSON.stringify(localWd)) {
        saveStoredCompanyWithdrawals(cloudData.companyWithdrawals);
        hasUpdates = true;
      }
    }

    // 9. Authoritative Audit Logs Sync
    if (Array.isArray(cloudData.auditLogs)) {
      const localLogs = getStoredAuditLogs();
      const logMap = new Map<string, any>();
      localLogs.forEach((l) => {
        if (l.id) logMap.set(l.id, l);
      });
      cloudData.auditLogs.forEach((l) => {
        if (l.id) logMap.set(l.id, l);
      });

      const mergedLogs = Array.from(logMap.values());
      if (mergedLogs.length !== localLogs.length || JSON.stringify(mergedLogs) !== JSON.stringify(localLogs)) {
        saveStoredAuditLogs(mergedLogs);
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      // Notify React components to re-render without triggering a reverse push
      broadcastRealtimeEvent('MANUAL_SYNC', { source: 'REMOTE_CLOUD_PULL' }, 'remote');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: { type: 'MANUAL_SYNC', origin: 'remote' } }));
        window.dispatchEvent(new CustomEvent('erikon_cloud_synced', { detail: { timestamp: new Date().toISOString() } }));
      }
    }

    lastSyncTimestamp = new Date().toLocaleTimeString();
    return true;
  } finally {
    // Release remote sync lock after a brief cool-off
    setTimeout(() => {
      isApplyingRemoteUpdate = false;
    }, 120);
  }
};

/**
 * Pulls latest state from authoritative cloud backends and merges into local storage
 */
export const pullCloudToLocal = async (): Promise<boolean> => {
  // 1. Try direct Firebase Realtime Database read first if configured
  if (isFirebaseConfigured() && isRealtimeCloudConnected()) {
    try {
      const rtdbData = await getRealtimeDatabaseVault();
      if (
        rtdbData &&
        ((Array.isArray(rtdbData.registeredUsers) && rtdbData.registeredUsers.length > 0) ||
         (Array.isArray(rtdbData.customers) && rtdbData.customers.length > 0) ||
         (Array.isArray(rtdbData.transactions) && rtdbData.transactions.length > 0))
      ) {
        return applyIncomingCloudVault(rtdbData);
      }
    } catch (e) {
      console.warn('[CloudSync] RTDB pull error:', e);
    }
  }

  // 2. Fallback to HTTP sync endpoints
  const endpoints = getSyncEndpoints();
  let cloudData: CloudVaultPayload | null = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
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
           (Array.isArray(vault.accounts) && vault.accounts.length > 0) ||
           (Array.isArray(vault.transactions) && vault.transactions.length > 0) ||
           (Array.isArray(vault.deletedCustomerIds) && vault.deletedCustomerIds.length > 0))
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
 * - Listens to live SSE & WebSocket events for sub-second cross-device reaction
 * - Re-syncs immediately on remote notifications, screen focus, tab visibility, or online event
 * - Keeps a 2.5s fast heartbeat poll so mobile and desktop stay synchronized seamlessly
 */
export const initCloudSync = () => {
  // Initial pull on app launch
  pullCloudToLocal().catch(() => {});

  // Handle local user actions and incoming remote sync notifications
  const unsubscribeEvents = subscribeRealtimeEvents((event) => {
    // If currently applying a remote payload, do not push
    if (isApplyingRemoteUpdate) {
      return;
    }

    if (event.origin === 'remote') {
      // High-speed cross-device synchronization: Another device performed a CRUD action or sync!
      // Immediately pull fresh state into this device
      pullCloudToLocal().catch(() => {});
      return;
    }

    if (event.type === 'MANUAL_SYNC') {
      if (event.data?.source === 'USER_REFRESH') {
        pullCloudToLocal().catch(() => {});
      }
    } else {
      // Local user operation on this device (e.g. deposit recorded, customer registered, customer deleted, loan created)
      pushLocalToCloud().catch(() => {});
    }
  });

  // Fast background heartbeat poller (every 2.5s)
  // Guarantees all devices (mobile, tablet, desktop) reflect changes within 1-2 seconds regardless of SSE disconnects
  const pollTimer = setInterval(() => {
    pullCloudToLocal().catch(() => {});
  }, 2500);

  // Instant sync on screen resume / tab focus (important for mobile devices)
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

  // Attach live sub-second Firebase Realtime Database onValue listener
  const unsubscribeFirestore = subscribeRealtimeDatabaseVault((vaultData) => {
    if (vaultData && !isPushing) {
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
      pushLocalToCloud().catch(() => {});
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to import pairing bundle', err);
    return false;
  }
};
