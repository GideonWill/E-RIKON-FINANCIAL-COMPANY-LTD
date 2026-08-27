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
    const deletedUserEmails = new Set<string>(
      (incoming.deletedUserEmails || []).map((e: string) => e.toLowerCase())
    );
    (this.vault.deletedUserEmails || []).forEach((e: string) => deletedUserEmails.add(e.toLowerCase()));
    this.vault.deletedUserEmails = Array.from(deletedUserEmails);

    // 1. Registered Users
    if (Array.isArray(incoming.registeredUsers)) {
      if (incoming.authoritative || incoming.registeredUsers.length <= 1) {
        // Authoritative replacement filtered by tombstones
        this.vault.registeredUsers = incoming.registeredUsers.filter(
          (u) => !deletedUserEmails.has(u.email?.toLowerCase())
        );
      } else {
        const existingUsersMap = new Map<string, any>();
        (this.vault.registeredUsers || []).forEach((u) => {
          if (!deletedUserEmails.has(u.email?.toLowerCase())) {
            existingUsersMap.set(u.email.toLowerCase(), u);
          }
        });

        incoming.registeredUsers.forEach((incomingUser) => {
          const key = incomingUser.email?.toLowerCase();
          if (!key || deletedUserEmails.has(key)) return;

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
    } else {
      this.vault.registeredUsers = (this.vault.registeredUsers || []).filter(
        (u) => !deletedUserEmails.has(u.email?.toLowerCase())
      );
    }

    // 2. Approvals
    if (Array.isArray(incoming.approvals)) {
      if (incoming.authoritative) {
        this.vault.approvals = incoming.approvals.filter(
          (a) => !deletedUserEmails.has(a.details?.email?.toLowerCase())
        );
      } else {
        const apprMap = new Map<string, any>();
        (this.vault.approvals || []).forEach((a) => {
          if (!deletedUserEmails.has(a.details?.email?.toLowerCase())) {
            apprMap.set(a.id, a);
          }
        });

        incoming.approvals.forEach((incomingAppr) => {
          if (deletedUserEmails.has(incomingAppr.details?.email?.toLowerCase())) return;
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
    } else {
      this.vault.approvals = (this.vault.approvals || []).filter(
        (a) => !deletedUserEmails.has(a.details?.email?.toLowerCase())
      );
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
