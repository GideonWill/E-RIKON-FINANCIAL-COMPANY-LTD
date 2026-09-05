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
    // 0. Process & persist deleted user and customer tombstones
    if (Array.isArray(incoming.deletedUserEmails)) {
      const existingUserDel = new Set((this.vault.deletedUserEmails || []).map((e) => e.toLowerCase()));
      incoming.deletedUserEmails.forEach((email) => {
        if (email) existingUserDel.add(email.toLowerCase());
      });
      this.vault.deletedUserEmails = Array.from(existingUserDel);

      if (Array.isArray(this.vault.registeredUsers)) {
        this.vault.registeredUsers = this.vault.registeredUsers.filter(
          (u) => !existingUserDel.has((u.email || '').toLowerCase()) && !existingUserDel.has((u.id || '').toLowerCase())
        );
      }
    }

    if (Array.isArray(incoming.deletedCustomerIds)) {
      const existingCustDel = new Set(this.vault.deletedCustomerIds || []);
      incoming.deletedCustomerIds.forEach((id) => {
        if (id) existingCustDel.add(id);
      });
      this.vault.deletedCustomerIds = Array.from(existingCustDel);
    }

    const activeDeletedCustomerIds = new Set(this.vault.deletedCustomerIds || []);
    const activeDeletedUserEmails = new Set((this.vault.deletedUserEmails || []).map((e) => e.toLowerCase()));

    // 1. Registered Users
    if (Array.isArray(incoming.registeredUsers)) {
      const existingUsersMap = new Map<string, any>();
      (this.vault.registeredUsers || []).forEach((u) => {
        if (u.email && !activeDeletedUserEmails.has(u.email.toLowerCase())) {
          existingUsersMap.set(u.email.toLowerCase(), u);
        }
      });

      incoming.registeredUsers.forEach((incomingUser) => {
        const key = incomingUser.email?.toLowerCase();
        if (!key || activeDeletedUserEmails.has(key)) return;

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
        if (!activeDeletedCustomerIds.has(a.targetId) && !activeDeletedUserEmails.has(a.targetId?.toLowerCase())) {
          apprMap.set(a.id, a);
        }
      });

      incoming.approvals.forEach((incomingAppr) => {
        if (activeDeletedCustomerIds.has(incomingAppr.targetId) || activeDeletedUserEmails.has(incomingAppr.targetId?.toLowerCase())) {
          return;
        }
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

    // 3. Customers (Purge any matching activeDeletedCustomerIds)
    if (Array.isArray(incoming.customers)) {
      this.vault.customers = incoming.customers.filter(
        (c) => !activeDeletedCustomerIds.has(c.id) && !activeDeletedCustomerIds.has(c.customerNumber)
      );
    } else if (Array.isArray(this.vault.customers)) {
      this.vault.customers = this.vault.customers.filter(
        (c) => !activeDeletedCustomerIds.has(c.id) && !activeDeletedCustomerIds.has(c.customerNumber)
      );
    }

    // 4. Accounts (Purge accounts belonging to deleted customers)
    if (Array.isArray(incoming.accounts)) {
      this.vault.accounts = incoming.accounts.filter(
        (a) => !activeDeletedCustomerIds.has(a.customerId) &&
               !activeDeletedCustomerIds.has(a.id) &&
               !activeDeletedCustomerIds.has(a.customer?.id) &&
               !activeDeletedCustomerIds.has(a.customer?.customerNumber)
      );
    } else if (Array.isArray(this.vault.accounts)) {
      this.vault.accounts = this.vault.accounts.filter(
        (a) => !activeDeletedCustomerIds.has(a.customerId) &&
               !activeDeletedCustomerIds.has(a.id) &&
               !activeDeletedCustomerIds.has(a.customer?.id) &&
               !activeDeletedCustomerIds.has(a.customer?.customerNumber)
      );
    }

    // 5. Transactions (Purge transactions belonging to deleted customers/accounts)
    if (Array.isArray(incoming.transactions)) {
      this.vault.transactions = incoming.transactions.filter((t) => {
        if (activeDeletedCustomerIds.has(t.id) || (t.receiptNo && activeDeletedCustomerIds.has(t.receiptNo))) return false;
        const custId = t.customerId || t.account?.customerId || t.account?.customer?.id;
        const custNo = t.customer?.customerNumber || t.account?.customer?.customerNumber;
        if (custId && activeDeletedCustomerIds.has(custId)) return false;
        if (custNo && activeDeletedCustomerIds.has(custNo)) return false;
        return true;
      });
    } else if (Array.isArray(this.vault.transactions)) {
      this.vault.transactions = this.vault.transactions.filter((t) => {
        if (activeDeletedCustomerIds.has(t.id) || (t.receiptNo && activeDeletedCustomerIds.has(t.receiptNo))) return false;
        const custId = t.customerId || t.account?.customerId || t.account?.customer?.id;
        const custNo = t.customer?.customerNumber || t.account?.customer?.customerNumber;
        if (custId && activeDeletedCustomerIds.has(custId)) return false;
        if (custNo && activeDeletedCustomerIds.has(custNo)) return false;
        return true;
      });
    }

    if (Array.isArray(incoming.loans)) {
      this.vault.loans = incoming.loans.filter(
        (l) => !activeDeletedCustomerIds.has(l.customerId) && !activeDeletedCustomerIds.has(l.customer?.id)
      );
    } else if (Array.isArray(this.vault.loans)) {
      this.vault.loans = this.vault.loans.filter(
        (l) => !activeDeletedCustomerIds.has(l.customerId) && !activeDeletedCustomerIds.has(l.customer?.id)
      );
    }

    if (Array.isArray(incoming.companyInterest)) {
      this.vault.companyInterest = incoming.companyInterest.filter(
        (i) => !activeDeletedCustomerIds.has(i.customerId)
      );
    } else if (Array.isArray(this.vault.companyInterest)) {
      this.vault.companyInterest = this.vault.companyInterest.filter(
        (i) => !activeDeletedCustomerIds.has(i.customerId)
      );
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
      deletedCustomerIds: this.vault.deletedCustomerIds,
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
