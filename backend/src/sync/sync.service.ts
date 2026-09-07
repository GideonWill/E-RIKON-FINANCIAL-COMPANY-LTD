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
    // Immediate authoritative replacement (clears old test data and prevents re-merging)
    if (incoming.authoritative) {
      if (Array.isArray(incoming.customers)) {
        this.vault.customers = incoming.customers;
      }
      if (Array.isArray(incoming.accounts)) {
        this.vault.accounts = incoming.accounts;
      }
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
      if (Array.isArray(incoming.registeredUsers)) {
        this.vault.registeredUsers = incoming.registeredUsers;
      }
      this.vault.deletedCustomerIds = [];
      this.vault.approvals = (incoming.approvals || this.vault.approvals || []).filter((a) => a.type === 'STAFF_ROLE_SIGNUP');
      this.vault.updatedAt = new Date().toISOString();

      this.eventsService.broadcast('MANUAL_SYNC', {
        source: 'LIVE_BACKEND_SYNC',
        updatedAt: this.vault.updatedAt,
        deletedCustomerIds: [],
      });
      return this.vault;
    }

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

    // 3. Customers (Merge, purge deleted, and deduplicate strictly)
    const custMap = new Map<string, any>();
    (this.vault.customers || []).forEach((c) => {
      if (c && c.id && !activeDeletedCustomerIds.has(c.id) && (!c.customerNumber || !activeDeletedCustomerIds.has(c.customerNumber))) {
        custMap.set(c.id, c);
      }
    });

    if (Array.isArray(incoming.customers)) {
      incoming.customers.forEach((c) => {
        if (!c || !c.id) return;
        if (activeDeletedCustomerIds.has(c.id) || (c.customerNumber && activeDeletedCustomerIds.has(c.customerNumber))) return;
        const existing = custMap.get(c.id);
        custMap.set(c.id, existing ? { ...existing, ...c } : c);
      });
    }

    const seenCustNos = new Set<string>();
    const cleanCusts: any[] = [];

    // Allow multiple accounts and clients to share the same Ghana Card ID
    Array.from(custMap.values()).forEach((c) => {
      if (c.customerNumber && seenCustNos.has(c.customerNumber)) return;

      if (c.customerNumber) seenCustNos.add(c.customerNumber);
      cleanCusts.push(c);
    });
    this.vault.customers = cleanCusts;

    // 4. Accounts (Merge & Purge accounts belonging to deleted customers)
    const accMap = new Map<string, any>();
    (this.vault.accounts || []).forEach((a) => {
      const key = a.id || a.accountNumber;
      if (key && !activeDeletedCustomerIds.has(a.customerId) && !activeDeletedCustomerIds.has(a.id) && (!a.customer?.id || !activeDeletedCustomerIds.has(a.customer.id))) {
        accMap.set(key, a);
      }
    });

    if (Array.isArray(incoming.accounts)) {
      incoming.accounts.forEach((incomingAcc) => {
        const key = incomingAcc.id || incomingAcc.accountNumber;
        if (!key) return;
        if (activeDeletedCustomerIds.has(incomingAcc.customerId) || activeDeletedCustomerIds.has(incomingAcc.id) || (incomingAcc.customer?.id && activeDeletedCustomerIds.has(incomingAcc.customer.id))) {
          return;
        }
        const existing = accMap.get(key);
        if (existing) {
          const merged = { ...existing, ...incomingAcc };
          if (existing.dailyCycles && (!incomingAcc.dailyCycles || incomingAcc.dailyCycles.length === 0)) {
            merged.dailyCycles = existing.dailyCycles;
          }
          accMap.set(key, merged);
        } else {
          accMap.set(key, incomingAcc);
        }
      });
    }

    // Auto-recover any accounts from transactions if missing
    (this.vault.transactions || []).concat(incoming.transactions || []).forEach((t) => {
      if (t.account && t.account.id) {
        const key = t.account.id || t.account.accountNumber;
        if (key && !accMap.has(key)) {
          if (!activeDeletedCustomerIds.has(t.account.customerId) && !activeDeletedCustomerIds.has(t.account.id)) {
            accMap.set(key, t.account);
          }
        }
      }
    });

    this.vault.accounts = Array.from(accMap.values());

    // 5. Transactions (Merge & Purge transactions belonging to deleted customers/accounts)
    const txMap = new Map<string, any>();
    (this.vault.transactions || []).forEach((t) => {
      const key = t.id || t.receiptNo;
      if (key && !activeDeletedCustomerIds.has(t.id) && (!t.receiptNo || !activeDeletedCustomerIds.has(t.receiptNo))) {
        const custId = t.customerId || t.account?.customerId || t.account?.customer?.id;
        const custNo = t.customer?.customerNumber || t.account?.customer?.customerNumber;
        if ((!custId || !activeDeletedCustomerIds.has(custId)) && (!custNo || !activeDeletedCustomerIds.has(custNo))) {
          txMap.set(key, t);
        }
      }
    });

    if (Array.isArray(incoming.transactions)) {
      incoming.transactions.forEach((t) => {
        const key = t.id || t.receiptNo;
        if (!key || activeDeletedCustomerIds.has(t.id) || (t.receiptNo && activeDeletedCustomerIds.has(t.receiptNo))) return;
        const custId = t.customerId || t.account?.customerId || t.account?.customer?.id;
        const custNo = t.customer?.customerNumber || t.account?.customer?.customerNumber;
        if (custId && activeDeletedCustomerIds.has(custId)) return;
        if (custNo && activeDeletedCustomerIds.has(custNo)) return;
        txMap.set(key, t);
      });
    }

    this.vault.transactions = Array.from(txMap.values());

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
