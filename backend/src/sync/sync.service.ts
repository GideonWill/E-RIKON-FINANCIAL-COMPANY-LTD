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
  deletedUserEmails?: string[];
  deletedCustomerIds?: string[];
  authoritative?: boolean;
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
    deletedUserEmails: [],
    deletedCustomerIds: [],
    updatedAt: new Date().toISOString(),
  };

  constructor(private readonly eventsService: EventsService) {}

  getVault(): CloudVaultPayload {
    return this.vault;
  }

  updateVault(incoming: Partial<CloudVaultPayload>): CloudVaultPayload {
    // 1. Registered Users
    if (Array.isArray(incoming.registeredUsers)) {
      const existingUsersMap = new Map<string, any>();
      (this.vault.registeredUsers || []).forEach((u) => {
        if (u.email) existingUsersMap.set(u.email.toLowerCase(), u);
      });

      incoming.registeredUsers.forEach((incomingUser) => {
        const key = incomingUser.email?.toLowerCase();
        if (!key) return;

        const existingUser = existingUsersMap.get(key);
        if (existingUser) {
          const isApproved = Boolean(
            existingUser.isApproved || incomingUser.isApproved || incomingUser.role === 'SUPER_ADMIN'
          );
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

    // 2. Approvals
    if (Array.isArray(incoming.approvals)) {
      const apprMap = new Map<string, any>();
      (this.vault.approvals || []).forEach((a) => {
        apprMap.set(a.id, a);
      });

      incoming.approvals.forEach((incomingAppr) => {
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
      if ((incoming as any).isReset) {
        this.vault.customers = [];
      } else {
        const custMap = new Map<string, any>();
        (this.vault.customers || []).forEach((c) => {
          if (c.id) custMap.set(c.id, c);
          if (c.customerNumber) custMap.set(c.customerNumber, c);
        });
        incoming.customers.forEach((c) => {
          if (c.id) custMap.set(c.id, c);
        });
        this.vault.customers = Array.from(new Set(Array.from(custMap.values()).map(c => c.id))).map(id => custMap.get(id)!);
      }
    }

    // 4. Accounts
    if (Array.isArray(incoming.accounts)) {
      if ((incoming as any).isReset) {
        this.vault.accounts = [];
      } else {
        const accMap = new Map<string, any>();
        (this.vault.accounts || []).forEach((a) => {
          if (a.id) accMap.set(a.id, a);
        });
        incoming.accounts.forEach((a) => {
          if (a.id) accMap.set(a.id, a);
        });
        this.vault.accounts = Array.from(accMap.values());
      }
    }

    // 5. Transactions
    if (Array.isArray(incoming.transactions)) {
      if ((incoming as any).isReset) {
        this.vault.transactions = [];
      } else {
        const txMap = new Map<string, any>();
        (this.vault.transactions || []).forEach((t) => {
          if (t.id) txMap.set(t.id, t);
        });
        incoming.transactions.forEach((t) => {
          if (t.id) txMap.set(t.id, t);
        });
        this.vault.transactions = Array.from(txMap.values());
      }
    }

    if (Array.isArray(incoming.loans)) {
      if ((incoming as any).isReset) {
        this.vault.loans = [];
      } else {
        const loanMap = new Map<string, any>();
        (this.vault.loans || []).forEach((l) => { if (l.id) loanMap.set(l.id, l); });
        incoming.loans.forEach((l) => { if (l.id) loanMap.set(l.id, l); });
        this.vault.loans = Array.from(loanMap.values());
      }
    }

    if (Array.isArray(incoming.companyInterest)) {
      if ((incoming as any).isReset) {
        this.vault.companyInterest = [];
      } else {
        const intMap = new Map<string, any>();
        (this.vault.companyInterest || []).forEach((i) => {
          const key = `${i.accountNumber || i.accountId || i.customerId}-cyc-${i.cycleNumber}`;
          intMap.set(key, i);
        });
        incoming.companyInterest.forEach((i) => {
          const key = `${i.accountNumber || i.accountId || i.customerId}-cyc-${i.cycleNumber}`;
          intMap.set(key, i);
        });
        this.vault.companyInterest = Array.from(intMap.values());
      }
    }

    if (Array.isArray(incoming.companyWithdrawals)) {
      if ((incoming as any).isReset) {
        this.vault.companyWithdrawals = [];
      } else {
        const wdMap = new Map<string, any>();
        (this.vault.companyWithdrawals || []).forEach((w) => { if (w.id) wdMap.set(w.id, w); });
        incoming.companyWithdrawals.forEach((w) => { if (w.id) wdMap.set(w.id, w); });
        this.vault.companyWithdrawals = Array.from(wdMap.values());
      }
    }

    if (Array.isArray(incoming.auditLogs)) {
      if ((incoming as any).isReset) {
        this.vault.auditLogs = [];
      } else {
        const logMap = new Map<string, any>();
        (this.vault.auditLogs || []).forEach((l) => { if (l.id) logMap.set(l.id, l); });
        incoming.auditLogs.forEach((l) => { if (l.id) logMap.set(l.id, l); });
        this.vault.auditLogs = Array.from(logMap.values());
      }
    }

    if (Array.isArray(incoming.branches)) {
      this.vault.branches = incoming.branches;
    }

    this.vault.updatedAt = new Date().toISOString();

    // Broadcast instant sync event to ALL connected devices
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
      deletedUserEmails: [],
      deletedCustomerIds: [],
      updatedAt: new Date().toISOString(),
    };

    this.eventsService.broadcast('DATA_RESET', {
      source: 'LIVE_BACKEND_RESET',
      resetAt: this.vault.updatedAt,
    });

    return this.vault;
  }
}
