import { useEffect, useRef } from 'react';

// ─── BroadcastChannel (same-tab / same-browser sync) ──────────────────────────
const SYNC_CHANNEL_NAME = 'erikon_ecfms_realtime_sync';
let syncChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not supported in current environment', e);
  }
}

// ─── SSE (Server-Sent Events — cross-device real-time fallback) ───────────────
let sseSource: EventSource | null = null;
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sseReconnectDelay = 1000;
const SSE_MAX_DELAY = 30_000;

const SSE_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://e-rikon-ecfms-backend.onrender.com/api';

export type SyncEventType =
  | 'CUSTOMER_REGISTERED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_DELETED'
  | 'ACCOUNT_OPENED'
  | 'PACKAGE_DEPOSIT_RECORDED'
  | 'DEPOSIT_RECORDED'
  | 'WITHDRAWAL_RECORDED'
  | 'LOAN_CREATED'
  | 'LOAN_APPROVED'
  | 'LOAN_DISBURSED'
  | 'LOAN_REPAYMENT_RECORDED'
  | 'COMPANY_INTEREST_ACCUMULATED'
  | 'INTEREST_WITHDRAWAL_REQUESTED'
  | 'AUDIT_LOG_RECORDED'
  | 'APPROVAL_DECISION_MADE'
  | 'APPROVAL_PROCESSED'
  | 'STAFF_REGISTERED'
  | 'USER_DELETED'
  | 'USER_STATUS_CHANGED'
  | 'USER_BLOCKED'
  | 'USER_UNBLOCKED'
  | 'STAFF_POSITION_APPLIED'
  | 'FINANCIAL_RECEIPTS_CLEARED'
  | 'VAULT_CLEARED'
  | 'DATA_RESET'
  | 'NEW_SAVINGS_CYCLE_STARTED'
  | 'MANUAL_SYNC';

export interface RealtimeSyncPayload {
  type: SyncEventType;
  timestamp: string;
  data?: any;
  origin?: 'local' | 'remote';
}

// ─── Subscriber registry ───────────────────────────────────────────────────────
const subscribers = new Set<(payload: RealtimeSyncPayload) => void>();

const notifyAllSubscribers = (payload: RealtimeSyncPayload) => {
  subscribers.forEach((cb) => {
    try {
      cb(payload);
    } catch {}
  });
};

// ─── SSE Connection (Backup stream) ───────────────────────────────────────────

/**
 * Connect to the backend SSE endpoint (as secondary live stream)
 */
export const connectSSE = (token?: string): void => {
  if (sseSource) {
    return;
  }

  // Only connect if in browser
  if (typeof window === 'undefined') return;

  const activeToken = token || localStorage.getItem('erikon_access_token') || 'guest';
  const url = `${SSE_BASE_URL}/events?token=${encodeURIComponent(activeToken)}`;

  try {
    sseSource = new EventSource(url);

    sseSource.onopen = () => {
      console.log('[SSE] ✅ Connected to backend stream');
      sseReconnectDelay = 1000;
    };

    sseSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as RealtimeSyncPayload;
        payload.origin = 'remote';
        // Broadcast to all same-tab subscribers
        notifyAllSubscribers(payload);
        // Also relay to other browser tabs via BroadcastChannel
        if (syncChannel) {
          try {
            syncChannel.postMessage(payload);
          } catch {}
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: payload }));
        }
      } catch (e) {
        // Heartbeat comments
      }
    };

    sseSource.onerror = () => {
      disconnectSSE(false);
      sseReconnectTimer = setTimeout(() => {
        sseReconnectDelay = Math.min(sseReconnectDelay * 2, SSE_MAX_DELAY);
        connectSSE(token);
      }, sseReconnectDelay);
    };
  } catch (e) {
    console.warn('[SSE] Notice: Connection not available, continuing with Firebase Realtime Database.');
  }
};

export const disconnectSSE = (clearToken = true): void => {
  if (sseReconnectTimer) {
    clearTimeout(sseReconnectTimer);
    sseReconnectTimer = null;
  }
  if (sseSource) {
    sseSource.onopen = null;
    sseSource.onmessage = null;
    sseSource.onerror = null;
    sseSource.close();
    sseSource = null;
    if (clearToken) {
      console.log('[SSE] Disconnected from stream');
    }
  }
};

// ─── Subscribe to real-time events ────────────────────────────────────────────

export const subscribeRealtimeEvents = (
  callback: (payload: RealtimeSyncPayload) => void
): (() => void) => {
  subscribers.add(callback);

  // Handle BroadcastChannel messages (from other tabs on the same browser)
  const handleBroadcastMessage = (event: MessageEvent<RealtimeSyncPayload>) => {
    if (event.data) {
      const payload = { ...event.data, origin: (event.data.origin || 'remote') as 'local' | 'remote' };
      callback(payload);
    }
  };

  // Handle localStorage changes from other tabs
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key && event.key.startsWith('erikon_')) {
      callback({
        type: 'MANUAL_SYNC',
        timestamp: new Date().toISOString(),
        data: { key: event.key },
        origin: 'remote',
      });
    }
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', handleBroadcastMessage);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }

  return () => {
    subscribers.delete(callback);
    if (syncChannel) {
      syncChannel.removeEventListener('message', handleBroadcastMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
};

// ─── Broadcast a local real-time event ────────────────────────────────────────

export const broadcastRealtimeEvent = (
  type: SyncEventType, 
  data?: any, 
  origin: 'local' | 'remote' = 'local'
) => {
  const payload: RealtimeSyncPayload = {
    type,
    timestamp: new Date().toISOString(),
    data,
    origin,
  };

  // Relay to BroadcastChannel (other tabs)
  if (syncChannel) {
    try {
      syncChannel.postMessage(payload);
    } catch (e) {
      console.warn('Error posting broadcast message', e);
    }
  }

  // Notify all direct subscribers in this tab
  notifyAllSubscribers(payload);
};

// ─── React Hook with automatic batching & debouncing ──────────────────────────

export const useRealtimeSync = (onUpdate: (payload: RealtimeSyncPayload) => void) => {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let latestPayload: RealtimeSyncPayload | null = null;

    const debouncedCallback = (payload: RealtimeSyncPayload) => {
      latestPayload = payload;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (latestPayload) {
          onUpdateRef.current(latestPayload);
        }
      }, 50);
    };

    const unsubscribe = subscribeRealtimeEvents(debouncedCallback);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, []);
};
