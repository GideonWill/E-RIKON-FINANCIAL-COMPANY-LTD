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

  constructor(private readonly eventsService: EventsService) { }

  getVault(): CloudVaultPayload {
    return this.vault;
  }

  updateVault(incoming: Partial<CloudVaultPayload>): CloudVaultPayload {
    // Merge or replace collections if provided
    if (Array.isArray(incoming.registeredUsers)) {
      this.vault.registeredUsers = incoming.registeredUsers;
    }
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
    if (Array.isArray(incoming.approvals)) {
      this.vault.approvals = incoming.approvals;
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
