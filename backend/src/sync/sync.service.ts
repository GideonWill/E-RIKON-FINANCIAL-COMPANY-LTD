import { Injectable } from '@nestjs/common';
import { EventsService } from '../events/events.service';

export interface CloudVaultPayload {
  registeredUsers?: any[];
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

@Injectable()
export class SyncService {
  private vault: CloudVaultPayload = {
    registeredUsers: [],
    customers: [],
    accounts: [],
    transactions: [],
    loans: [],
    companyInterest: [],
    companyWithdrawals: [],
    approvals: [],
    auditLogs: [],
    branches: [],
    updatedAt: new Date().toISOString(),
  };

  constructor(private readonly eventsService: EventsService) {}

  getVault(): CloudVaultPayload {
    return this.vault;
  }

  updateVault(incoming: Partial<CloudVaultPayload>): CloudVaultPayload {
    // 1. Merge registered users by email and preserve approval status
    if (Array.isArray(incoming.registeredUsers) && incoming.registeredUsers.length > 0) {
      const existingUsersMap = new Map<string, any>();
      (this.vault.registeredUsers || []).forEach(u => existingUsersMap.set(u.email.toLowerCase(), u));
      
      incoming.registeredUsers.forEach(incomingUser => {
        const key = incomingUser.email.toLowerCase();
        const existingUser = existingUsersMap.get(key);
        if (existingUser) {
          const isApproved = Boolean(existingUser.isApproved || incomingUser.isApproved || incomingUser.role === 'SUPER_ADMIN');
          existingUsersMap.set(key, {
            ...existingUser,
            ...incomingUser,
            isApproved,
            status: isApproved ? 'ACTIVE' : (existingUser.status === 'ACTIVE' ? 'ACTIVE' : incomingUser.status || 'PENDING_APPROVAL'),
          });
        } else {
          existingUsersMap.set(key, incomingUser);
        }
      });
      this.vault.registeredUsers = Array.from(existingUsersMap.values());
    }

    // 2. Merge approvals by id and preserve reviewed state
    if (Array.isArray(incoming.approvals)) {
      const apprMap = new Map<string, any>();
      (this.vault.approvals || []).forEach(a => apprMap.set(a.id, a));
      
      incoming.approvals.forEach(incomingAppr => {
        const existingAppr = apprMap.get(incomingAppr.id);
        if (existingAppr) {
          if (existingAppr.status === 'APPROVED' || existingAppr.status === 'REJECTED') {
            apprMap.set(incomingAppr.id, existingAppr);
          } else {
            apprMap.set(incomingAppr.id, incomingAppr);
          }
        } else {
          apprMap.set(incomingAppr.id, incomingAppr);
        }
      });
      this.vault.approvals = Array.from(apprMap.values());
    }

    // 3. Customers
    if (Array.isArray(incoming.customers)) {
      const custMap = new Map<string, any>();
      (this.vault.customers || []).forEach(c => custMap.set(c.id, c));
      incoming.customers.forEach(c => custMap.set(c.id, c));
      this.vault.customers = Array.from(custMap.values());
    }

    // 4. Accounts
    if (Array.isArray(incoming.accounts)) {
      const accMap = new Map<string, any>();
      (this.vault.accounts || []).forEach(a => accMap.set(a.id, a));
      incoming.accounts.forEach(a => accMap.set(a.id, a));
      this.vault.accounts = Array.from(accMap.values());
    }

    // 5. Transactions
    if (Array.isArray(incoming.transactions)) {
      const txMap = new Map<string, any>();
      (this.vault.transactions || []).forEach(t => txMap.set(t.id, t));
      incoming.transactions.forEach(t => txMap.set(t.id, t));
      this.vault.transactions = Array.from(txMap.values());
    }

    if (Array.isArray(incoming.loans)) {
      this.vault.loans = incoming.loans;
    }
    if (Array.isArray(incoming.companyInterest)) {
      this.vault.companyInterest = incoming.companyInterest;
    }
    if (Array.isArray(incoming.companyWithdrawals)) {
      this.vault.companyWithdrawals = incoming.companyWithdrawals;
    }
    if (Array.isArray(incoming.auditLogs)) {
      this.vault.auditLogs = incoming.auditLogs;
    }
    if (Array.isArray(incoming.branches)) {
      this.vault.branches = incoming.branches;
    }

    this.vault.updatedAt = new Date().toISOString();

    // Broadcast instant sync event to ALL connected laptops, phones, and tablets
    this.eventsService.broadcast('MANUAL_SYNC', {
      source: 'LIVE_BACKEND_SYNC',
      updatedAt: this.vault.updatedAt,
    });

    return this.vault;
  }

  resetVault(): CloudVaultPayload {
    this.vault = {
      registeredUsers: [],
      customers: [],
      accounts: [],
      transactions: [],
      loans: [],
      companyInterest: [],
      companyWithdrawals: [],
      approvals: [],
      auditLogs: [],
      branches: [],
      updatedAt: new Date().toISOString(),
    };

    this.eventsService.broadcast('DATA_RESET', {
      source: 'LIVE_BACKEND_RESET',
      resetAt: this.vault.updatedAt,
    });

    return this.vault;
  }
}
