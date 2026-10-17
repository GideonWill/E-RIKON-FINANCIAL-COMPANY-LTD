import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Account, Transaction, User } from '@prisma/client';

/**
 * High-Performance Batch DataLoader Service
 * Eliminates N+1 query patterns across customers, accounts, transactions, and users
 * by batching individual entity lookups into single parameterized SQL IN-queries.
 */
@Injectable()
export class DataLoaderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Batch fetch accounts for multiple customers in a SINGLE SQL query
   * Eliminates customer.map(c => getAccounts(c.id)) N+1 query problem
   */
  async getAccountsByCustomerIds(customerIds: string[]): Promise<Map<string, Account[]>> {
    const uniqueIds = Array.from(new Set(customerIds.filter(Boolean)));
    const accountMap = new Map<string, Account[]>();

    if (uniqueIds.length === 0) {
      return accountMap;
    }

    // Single indexed query across all requested customers
    const accounts = await this.prisma.account.findMany({
      where: {
        customerId: { in: uniqueIds },
      },
      include: {
        dailyCycles: {
          where: { isCompleted: false },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Populate map with empty arrays first
    uniqueIds.forEach((id) => accountMap.set(id, []));

    // Group accounts by customerId
    accounts.forEach((acc) => {
      const list = accountMap.get(acc.customerId) || [];
      list.push(acc);
      accountMap.set(acc.customerId, list);
    });

    return accountMap;
  }

  /**
   * Batch calculate total account balances for multiple customers in ONE aggregated query
   */
  async getAggregatedBalancesByCustomerIds(
    customerIds: string[]
  ): Promise<Map<string, { totalCurrentBalance: number; totalAvailableBalance: number; accountCount: number }>> {
    const uniqueIds = Array.from(new Set(customerIds.filter(Boolean)));
    const balanceMap = new Map<string, { totalCurrentBalance: number; totalAvailableBalance: number; accountCount: number }>();

    if (uniqueIds.length === 0) {
      return balanceMap;
    }

    // Initialize map
    uniqueIds.forEach((id) =>
      balanceMap.set(id, { totalCurrentBalance: 0, totalAvailableBalance: 0, accountCount: 0 })
    );

    // Fetch account balances in a single indexed query
    const accounts = await this.prisma.account.findMany({
      where: {
        customerId: { in: uniqueIds },
        status: 'ACTIVE',
      },
      select: {
        customerId: true,
        currentBalance: true,
        availableBalance: true,
      },
    });

    accounts.forEach((acc) => {
      const entry = balanceMap.get(acc.customerId)!;
      entry.totalCurrentBalance += Number(acc.currentBalance);
      entry.totalAvailableBalance += Number(acc.availableBalance);
      entry.accountCount += 1;
    });

    return balanceMap;
  }

  /**
   * Batch fetch recent transactions for multiple accounts in a single query
   */
  async getRecentTransactionsByAccountIds(
    accountIds: string[],
    limit = 20
  ): Promise<Map<string, Transaction[]>> {
    const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));
    const txMap = new Map<string, Transaction[]>();

    if (uniqueIds.length === 0) {
      return txMap;
    }

    uniqueIds.forEach((id) => txMap.set(id, []));

    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: uniqueIds },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * uniqueIds.length,
    });

    transactions.forEach((tx) => {
      const list = txMap.get(tx.accountId) || [];
      if (list.length < limit) {
        list.push(tx);
        txMap.set(tx.accountId, list);
      }
    });

    return txMap;
  }

  /**
   * Batch fetch user profiles by user IDs in a single query
   */
  async getUsersByIds(
    userIds: string[]
  ): Promise<Map<string, Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role' | 'phone'>>> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    const userMap = new Map<string, Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role' | 'phone'>>();

    if (uniqueIds.length === 0) {
      return userMap;
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        phone: true,
      },
    });

    users.forEach((u) => userMap.set(u.id, u));
    return userMap;
  }
}
