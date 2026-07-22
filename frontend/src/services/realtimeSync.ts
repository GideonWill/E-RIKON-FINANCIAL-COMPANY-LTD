import { Customer, Account, Transaction, LoanApplication } from '../types';
import { 
  getStoredCustomers, 
  saveStoredCustomers, 
  getStoredAccounts, 
  saveStoredAccounts, 
  getStoredTransactions, 
  saveStoredTransactions, 
  getStoredLoans, 
  saveStoredLoans 
} from './api';

// Create a BroadcastChannel for multi-device / multi-tab real-time communication
const SYNC_CHANNEL_NAME = 'erikon_ecfms_realtime_sync';
let syncChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
}

export type SyncEventType = 
  | 'CUSTOMER_CREATED'
  | 'DEPOSIT_RECORDED'
  | 'WITHDRAWAL_RECORDED'
  | 'LOAN_CREATED'
  | 'LOAN_APPROVED'
  | 'LOAN_DISBURSED'
  | 'LOAN_REPAYMENT_RECORDED'
  | 'DAY_31_FEE_RETAINED';

export interface RealtimeSyncPayload {
  type: SyncEventType;
  timestamp: string;
  data?: any;
}

// Subscribe to real-time events across tabs and devices
export const subscribeRealtimeEvents = (callback: (payload: RealtimeSyncPayload) => void) => {
  if (syncChannel) {
    const handleMessage = (event: MessageEvent<RealtimeSyncPayload>) => {
      callback(event.data);
    };
    syncChannel.addEventListener('message', handleMessage);
    return () => syncChannel?.removeEventListener('message', handleMessage);
  }
  return () => {};
};

// Broadcast a real-time event
export const broadcastRealtimeEvent = (type: SyncEventType, data?: any) => {
  const payload: RealtimeSyncPayload = {
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  if (syncChannel) {
    syncChannel.postMessage(payload);
  }

  // Also trigger window custom event for same-tab subscribers
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: payload }));
  }
};
