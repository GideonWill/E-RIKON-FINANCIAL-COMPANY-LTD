import { useEffect } from 'react';

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

// ─── SSE (Server-Sent Events — cross-device real-time) ────────────────────────
let sseSource: EventSource | null = null;
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sseReconnectDelay = 1000; // Start at 1s, backs off exponentially up to 30s
const SSE_MAX_DELAY = 30_000;

const SSE_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://e-rikon-ecfms-backend.onrender.com/api');

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
  | 'APPROVAL_DECISION_MADE'
  | 'STAFF_REGISTERED'
  | 'USER_DELETED'
  | 'STAFF_POSITION_APPLIED'
  | 'FINANCIAL_RECEIPTS_CLEARED'
  | 'VAULT_CLEARED'
  | 'DATA_RESET'
  | 'MANUAL_SYNC';

export interface RealtimeSyncPayload {
  type: SyncEventType;
  timestamp: string;
  data?: any;
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

// ─── SSE Connection ────────────────────────────────────────────────────────────

/**
 * Connect to the Render backend SSE endpoint.
 * Can be called with token or guest mode.
 */
export const connectSSE = (token?: string): void => {
  if (sseSource) {
    // Already connected
    return;
  }

  const activeToken = token || localStorage.getItem('erikon_access_token') || 'guest';
  const url = `${SSE_BASE_URL}/events?token=${encodeURIComponent(activeToken)}`;

  console.log('[SSE] Connecting to real-time event stream...');
  sseSource = new EventSource(url);

  sseSource.onopen = () => {
    console.log('[SSE] ✅ Connected to E-RIKON real-time event stream');
    sseReconnectDelay = 1000; // Reset backoff on successful connection
  };

  sseSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as RealtimeSyncPayload;
      // Broadcast to all same-tab subscribers
      notifyAllSubscribers(payload);
      // Also relay to other browser tabs via BroadcastChannel
      if (syncChannel) {
        try {
          syncChannel.postMessage(payload);
        } catch {}
      }
      // Dispatch window custom event for legacy same-tab subscribers
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: payload }));
      }
    } catch (e) {
      // Server heartbeat comment lines (": heartbeat\n\n") will fail JSON parse — ignore them
    }
  };

  sseSource.onerror = () => {
    console.warn(`[SSE] Connection lost. Reconnecting in ${sseReconnectDelay / 1000}s...`);
    disconnectSSE(false); // Close the broken connection without clearing the token

    // Exponential backoff reconnect
    sseReconnectTimer = setTimeout(() => {
      sseReconnectDelay = Math.min(sseReconnectDelay * 2, SSE_MAX_DELAY);
      connectSSE(token);
    }, sseReconnectDelay);
  };
};

/**
 * Disconnect SSE stream. Call on logout.
 * @param clearToken - If true (default), prevents auto-reconnect.
 */
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
      console.log('[SSE] Disconnected from real-time event stream');
    }
  }
};

// ─── Subscribe to real-time events ────────────────────────────────────────────

/**
 * Subscribe to real-time events from both SSE (cross-device) and BroadcastChannel (same-browser).
 * Returns an unsubscribe function.
 */
export const subscribeRealtimeEvents = (
  callback: (payload: RealtimeSyncPayload) => void
): (() => void) => {
  // Add to internal subscriber registry (receives SSE events relayed above)
  subscribers.add(callback);

  // Also handle BroadcastChannel messages (from other tabs on the same browser)
  const handleBroadcastMessage = (event: MessageEvent<RealtimeSyncPayload>) => {
    if (event.data) callback(event.data);
  };

  // Handle same-tab custom events (dispatched by local write operations in api.ts)
  const handleCustomEvent = (event: Event) => {
    const customEvt = event as CustomEvent<RealtimeSyncPayload>;
    if (customEvt.detail) callback(customEvt.detail);
  };

  // Handle localStorage changes from other tabs
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key && event.key.startsWith('erikon_')) {
      callback({
        type: 'MANUAL_SYNC',
        timestamp: new Date().toISOString(),
        data: { key: event.key },
      });
    }
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', handleBroadcastMessage);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('erikon_realtime_update', handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);
  }

  return () => {
    subscribers.delete(callback);
    if (syncChannel) {
      syncChannel.removeEventListener('message', handleBroadcastMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('erikon_realtime_update', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
};

// ─── Broadcast a local real-time event (same-device operations) ───────────────

export const broadcastRealtimeEvent = (type: SyncEventType, data?: any) => {
  const payload: RealtimeSyncPayload = {
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  // Relay to BroadcastChannel (other tabs)
  if (syncChannel) {
    try {
      syncChannel.postMessage(payload);
    } catch (e) {
      console.warn('Error posting broadcast message', e);
    }
  }

  // Dispatch custom event for same-tab subscribers
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: payload }));
  }

  // Also notify all direct subscribers
  notifyAllSubscribers(payload);
};

// ─── React Hook ───────────────────────────────────────────────────────────────

export const useRealtimeSync = (onUpdate: (payload: RealtimeSyncPayload) => void) => {
  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents(onUpdate);
    return () => unsubscribe();
  }, [onUpdate]);
};
