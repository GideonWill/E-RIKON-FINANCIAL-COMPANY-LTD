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
      console.error('[Firebase RTDB] Snapshot listener error:', error);
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
    await set(vaultRef, {
      ...payload,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error('[Firebase RTDB] Failed to write to Realtime Database vault:', err);
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
      return snap.val();
    }
    return null;
  } catch (err) {
    console.error('[Firebase RTDB] Failed to read from Realtime Database vault:', err);
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
