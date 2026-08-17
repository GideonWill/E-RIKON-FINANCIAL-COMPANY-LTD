import { useEffect } from 'react';

// Create a BroadcastChannel for multi-device / multi-tab real-time communication
const SYNC_CHANNEL_NAME = 'erikon_ecfms_realtime_sync';
let syncChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not supported in current environment', e);
  }
}

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
  | 'STAFF_POSITION_APPLIED'
  | 'FINANCIAL_RECEIPTS_CLEARED'
  | 'DATA_RESET'
  | 'MANUAL_SYNC';

export interface RealtimeSyncPayload {
  type: SyncEventType;
  timestamp: string;
  data?: any;
}

// Subscribe to real-time events across tabs and devices
export const subscribeRealtimeEvents = (callback: (payload: RealtimeSyncPayload) => void): (() => void) => {
  const handleCustomEvent = (event: Event) => {
    const customEvt = event as CustomEvent<RealtimeSyncPayload>;
    if (customEvt.detail) {
      callback(customEvt.detail);
    }
  };

  const handleBroadcastMessage = (event: MessageEvent<RealtimeSyncPayload>) => {
    if (event.data) {
      callback(event.data);
    }
  };

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

  // Periodic heartbeat sync (every 3 seconds) for multi-device network consistency
  const heartbeatInterval = setInterval(() => {
    callback({
      type: 'MANUAL_SYNC',
      timestamp: new Date().toISOString(),
    });
  }, 3000);

  return () => {
    if (syncChannel) {
      syncChannel.removeEventListener('message', handleBroadcastMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('erikon_realtime_update', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    }
    clearInterval(heartbeatInterval);
  };
};

// Broadcast a real-time event
export const broadcastRealtimeEvent = (type: SyncEventType, data?: any) => {
  const payload: RealtimeSyncPayload = {
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  if (syncChannel) {
    try {
      syncChannel.postMessage(payload);
    } catch (e) {
      console.warn('Error posting broadcast message', e);
    }
  }

  // Also trigger window custom event for same-tab subscribers
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: payload }));
  }
};

// React Hook to subscribe a component to real-time events
export const useRealtimeSync = (onUpdate: (payload: RealtimeSyncPayload) => void) => {
  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents(onUpdate);
    return () => unsubscribe();
  }, [onUpdate]);
};
