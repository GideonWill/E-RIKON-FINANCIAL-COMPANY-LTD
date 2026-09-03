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
      this.vault.customers = incoming.customers;
    }

    // 4. Accounts
    if (Array.isArray(incoming.accounts)) {
      this.vault.accounts = incoming.accounts;
    }

    // 5. Transactions
    if (Array.isArray(incoming.transactions)) {
      this.vault.transactions = incoming.transactions;
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

    if (incoming.authoritative) {
      this.vault.deletedCustomerIds = [];
      this.vault.approvals = (this.vault.approvals || []).filter((a) => a.type === 'STAFF_ROLE_SIGNUP');
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
      registeredUsers: this.vault.registeredUsers || [],
      customers: [],
      accounts: [],
      transactions: [],
      loans: [],
      companyInterest: [],
      companyWithdrawals: [],
      approvals: (this.vault.approvals || []).filter((a) => a.type === 'STAFF_ROLE_SIGNUP'),
      auditLogs: [],
      branches: this.vault.branches || [],
      deletedUserEmails: this.vault.deletedUserEmails || [],
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
