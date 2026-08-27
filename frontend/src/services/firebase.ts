import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  enableIndexedDbPersistence 
} from 'firebase/firestore';

// Firebase configuration for E-RIKON Financial Company PLC
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBexTaAkNwo39yg-Us8ckp8oFf_wJmRO1Y",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "erikon-company-plc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "erikon-company-plc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "erikon-company-plc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "771545783989",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:771545783989:web:db166570a2ccaf713368fc",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MSDFK20MX6"
};

// Check if valid Firebase configuration is present
export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    !firebaseConfig.apiKey.includes('REPLACE_WITH')
  );
};

// Initialize Firebase App instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Enable offline persistence for unstable networks in Ghana
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firestore] Multiple tabs open; persistence can only be enabled in one tab at a time.');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firestore] The current browser does not support all features required for persistence.');
      }
    });
  } catch (e) {
    // Ignore persistence errors
  }
}

/**
 * Subscribes to live real-time Firestore updates for the global vault document.
 * When ANY device writes to Firestore, all subscribed laptops and phones receive
 * the live updated state in ~50ms via WebSocket connection.
 */
export const subscribeFirestoreVault = (
  onUpdate: (vaultData: any) => void,
  onError?: (err: Error) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    console.info('[Firestore] Firebase credentials not yet provided in .env. Falling back to live central relay.');
    return () => {};
  }

  const vaultDocRef = doc(db, 'system_vault', 'global_state');

  const unsubscribe = onSnapshot(
    vaultDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate(data);
      }
    },
    (error) => {
      console.error('[Firestore] Snapshot listener error:', error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
};

/**
 * Saves or updates state directly in the global Firestore vault document.
 */
export const saveFirestoreVault = async (payload: any): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    const vaultDocRef = doc(db, 'system_vault', 'global_state');
    await setDoc(vaultDocRef, {
      ...payload,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[Firestore] Failed to write to Firestore vault:', err);
    return false;
  }
};

/**
 * Reads the latest snapshot from Firestore once.
 */
export const getFirestoreVault = async (): Promise<any | null> => {
  if (!isFirebaseConfigured()) return null;
  try {
    const vaultDocRef = doc(db, 'system_vault', 'global_state');
    const snap = await getDoc(vaultDocRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error('[Firestore] Failed to read from Firestore vault:', err);
    return null;
  }
};
