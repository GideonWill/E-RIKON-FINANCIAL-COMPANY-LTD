import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  get,
  Database,
  Unsubscribe
} from 'firebase/database';

// Firebase Realtime Database configuration for E-RIKON COMPANY PLC
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBexTaAkNwo39yg-Us8ckp8oFf_wJmRO1Y',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'erikon-company-plc.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://erikon-company-plc-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'erikon-company-plc',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'erikon-company-plc.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '771545783989',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:771545783989:web:db166570a2ccaf713368fc'
};

// Check if valid Firebase configuration is present
export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    !firebaseConfig.apiKey.includes('your_firebase_api_key')
  );
};

// Initialize Firebase App & Realtime Database instance safely
let app: any = null;
let rtdb: Database | null = null;
let isConnectedToCloud = false;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    rtdb = getDatabase(app, firebaseConfig.databaseURL);
    console.log('[Firebase RTDB] Initialized successfully with database URL:', firebaseConfig.databaseURL);

    // Track live connection state
    const connectedRef = ref(rtdb, '.info/connected');
    onValue(connectedRef, (snap) => {
      isConnectedToCloud = snap.val() === true;
      if (isConnectedToCloud) {
        console.log('[Firebase RTDB] 🟢 Connected live to Google Cloud Realtime Database');
      } else {
        console.log('[Firebase RTDB] 🟡 Connecting / Reconnecting to Google Cloud...');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erikon_firebase_status', { detail: { connected: isConnectedToCloud } }));
      }
    });
  } catch (e) {
    console.warn('[Firebase RTDB] Initialization notice:', e);
  }
}

export const getFirebaseDatabase = (): Database | null => rtdb;
export const isRealtimeCloudConnected = (): boolean => isConnectedToCloud;

/**
 * Subscribes to live real-time Firebase Realtime Database updates for the global vault.
 * When ANY device (phone, laptop, tablet) writes to Firebase, all subscribed devices
 * receive the updated state in ~30-50ms via persistent WebSocket.
 */
export const subscribeRealtimeDatabaseVault = (
  onUpdate: (vaultData: any) => void,
  onError?: (err: Error) => void
): (() => void) => {
  if (!rtdb) {
    console.info('[Firebase RTDB] Realtime Database not initialized. Falling back to HTTP sync.');
    return () => {};
  }

  const vaultRef = ref(rtdb, 'system_vault');

  const unsubscribe = onValue(
    vaultRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        onUpdate(data);
      }
    },
    (error) => {
      console.warn('[Firebase RTDB] Snapshot listener notice (falling back to live SSE & HTTP sync):', error.message || error);
      isConnectedToCloud = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erikon_firebase_status', { detail: { connected: false } }));
      }
      if (onError) onError(error);
    }
  );

  return unsubscribe;
};

/**
 * Saves or updates state directly in the global Realtime Database vault.
 */
export const saveRealtimeDatabaseVault = async (payload: any): Promise<boolean> => {
  if (!rtdb) return false;
  try {
    const vaultRef = ref(rtdb, 'system_vault');
    const finalPayload = { ...payload };

    try {
      const snap = await get(vaultRef);
      if (snap.exists()) {
        const remote = snap.val() || {};

        // 1. Transactions: Non-destructive union merge
        if (Array.isArray(remote.transactions) && Array.isArray(payload.transactions)) {
          const txMap = new Map<string, any>();
          remote.transactions.forEach((t: any) => {
            const k = t.id || t.receiptNo || t.referenceNo;
            if (k) txMap.set(k, t);
          });
          payload.transactions.forEach((t: any) => {
            const k = t.id || t.receiptNo || t.referenceNo;
            if (k) {
              const ex = txMap.get(k);
              txMap.set(k, { ...ex, ...t });
            }
          });
          finalPayload.transactions = Array.from(txMap.values());
        }

        // 2. Accounts: Non-destructive merge preserving highest balance and cycles
        if (Array.isArray(remote.accounts) && Array.isArray(payload.accounts)) {
          const accMap = new Map<string, any>();
          remote.accounts.forEach((a: any) => {
            const k = a.accountNumber || a.id;
            if (k) accMap.set(k, a);
          });
          payload.accounts.forEach((a: any) => {
            const k = a.accountNumber || a.id;
            if (k) {
              const ex = accMap.get(k);
              if (ex) {
                const mergedBal = Math.max(ex.currentBalance || 0, a.currentBalance || 0);
                const mergedAvail = Math.max(ex.availableBalance || 0, a.availableBalance || 0);

                // Merge cycles keeping all cycle numbers and highest day count
                const cycleMap = new Map<number, any>();
                [...(ex.dailyCycles || []), ...(a.dailyCycles || [])].forEach((c: any) => {
                  if (!c) return;
                  const num = c.cycleNumber || 1;
                  const existingCycle = cycleMap.get(num);
                  if (!existingCycle) {
                    cycleMap.set(num, c);
                  } else {
                    const eDays = existingCycle.currentDayCount || 0;
                    const iDays = c.currentDayCount || 0;
                    if (iDays >= eDays) {
                      cycleMap.set(num, {
                        ...existingCycle,
                        ...c,
                        currentDayCount: Math.max(eDays, iDays),
                        dailySplits: (c.dailySplits?.length || 0) >= (existingCycle.dailySplits?.length || 0) ? c.dailySplits : existingCycle.dailySplits,
                      });
                    } else {
                      cycleMap.set(num, {
                        ...c,
                        ...existingCycle,
                        currentDayCount: Math.max(eDays, iDays),
                        dailySplits: (existingCycle.dailySplits?.length || 0) >= (c.dailySplits?.length || 0) ? existingCycle.dailySplits : c.dailySplits,
                      });
                    }
                  }
                });
                const mergedCycles = Array.from(cycleMap.values()).sort((c1: any, c2: any) => (c2.cycleNumber || 0) - (c1.cycleNumber || 0));

                accMap.set(k, {
                  ...ex,
                  ...a,
                  currentBalance: mergedBal,
                  availableBalance: mergedAvail,
                  dailyCycles: mergedCycles.length > 0 ? mergedCycles : (ex.dailyCycles || a.dailyCycles),
                });
              } else {
                accMap.set(k, a);
              }
            }
          });
          finalPayload.accounts = Array.from(accMap.values());
        }

        // 3. Customers: Union merge
        if (Array.isArray(remote.customers) && Array.isArray(payload.customers)) {
          const custMap = new Map<string, any>();
          remote.customers.forEach((c: any) => { if (c && c.id) custMap.set(c.id, c); });
          payload.customers.forEach((c: any) => {
            if (c && c.id) {
              const ex = custMap.get(c.id);
              custMap.set(c.id, { ...ex, ...c });
            }
          });
          finalPayload.customers = Array.from(custMap.values());
        }
      }
    } catch (mergeErr) {
      console.warn('[Firebase RTDB] Pre-merge read notice:', mergeErr);
    }

    await set(vaultRef, {
      ...finalPayload,
      updatedAt: new Date().toISOString(),
    });
    isConnectedToCloud = true;
    return true;
  } catch (err: any) {
    console.warn('[Firebase RTDB] Write notice (using SSE & HTTP relay):', err?.message || err);
    isConnectedToCloud = false;
    return false;
  }
};

/**
 * Reads the latest snapshot from Realtime Database once.
 */
export const getRealtimeDatabaseVault = async (): Promise<any | null> => {
  if (!rtdb) return null;
  try {
    const vaultRef = ref(rtdb, 'system_vault');
    const snap = await get(vaultRef);
    if (snap.exists()) {
      isConnectedToCloud = true;
      return snap.val();
    }
    return null;
  } catch (err: any) {
    console.warn('[Firebase RTDB] Read notice (using SSE & HTTP relay):', err?.message || err);
    isConnectedToCloud = false;
    return null;
  }
};

/**
 * Listen to live connection status changes (online/offline)
 */
export const subscribeFirebaseConnection = (onChange: (connected: boolean) => void): (() => void) => {
  onChange(isConnectedToCloud);
  const handler = (e: any) => {
    onChange(Boolean(e.detail?.connected));
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('erikon_firebase_status', handler);
    return () => window.removeEventListener('erikon_firebase_status', handler);
  }
  return () => {};
};

// Aliases for seamless backwards compatibility
export const db = rtdb;
export const subscribeFirestoreVault = subscribeRealtimeDatabaseVault;
export const saveFirestoreVault = saveRealtimeDatabaseVault;
export const getFirestoreVault = getRealtimeDatabaseVault;
