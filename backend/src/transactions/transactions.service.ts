import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TransactionType, PaymentMode, TransactionStatus, EntryType } from '@prisma/client';

export interface CreateTransactionDto {
  accountId: string;
  branchId: string;
  type: TransactionType;
  paymentMode: PaymentMode;
  amount: number;
  recordedById: string;
  approvedById?: string;
  remarks?: string;
  externalRef?: string;
  ipAddress?: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute financial transaction with ACID PostgreSQL Transaction
   * - Double-Entry Ledger Posting
   * - Account Balance Update (Current & Available)
   * - Audit Log creation
   * - Receipt Number Generation
   */
  async processFinancialTransaction(dto: CreateTransactionDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Transaction amount must be greater than GHS 0.00.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch target account
      const account = await tx.account.findUnique({
        where: { id: dto.accountId },
        include: { customer: true, branch: true },
      });

      if (!account) {
        throw new NotFoundException(`Account with ID ${dto.accountId} not found.`);
      }

      if (account.status !== 'ACTIVE') {
        throw new BadRequestException(`Account ${account.accountNumber} is inactive or frozen.`);
      }

      const previousBal = Number(account.currentBalance);
      let newBal = previousBal;

      // 2. Validate withdrawal bounds if applicable
      if (dto.type === TransactionType.WITHDRAWAL || dto.type === TransactionType.COMPANY_FEE_DEDUCTION) {
        if (Number(account.availableBalance) < dto.amount) {
          throw new BadRequestException(
            `Insufficient available balance. Available: GHS ${account.availableBalance}, Requested: GHS ${dto.amount}`
          );
        }
        newBal = previousBal - dto.amount;
      } else if (dto.type === TransactionType.DEPOSIT || dto.type === TransactionType.LOAN_REPAYMENT) {
        newBal = previousBal + dto.amount;
      } else if (dto.type === TransactionType.LOAN_DISBURSEMENT) {
        newBal = previousBal + dto.amount;
      }

      // Generate unique Receipt and Reference numbers
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const referenceNo = `TX-${dto.type.slice(0, 3)}-${datePrefix}-${randomSuffix}`;
      const receiptNo = `RCP-${datePrefix}-${randomSuffix}`;

      // 3. Create Transaction Record
      const transaction = await tx.transaction.create({
        data: {
          referenceNo,
          receiptNo,
          accountId: account.id,
          branchId: dto.branchId,
          type: dto.type,
          paymentMode: dto.paymentMode,
          amount: dto.amount,
          previousBal,
          newBal,
          status: TransactionStatus.COMPLETED,
          recordedById: dto.recordedById,
          approvedById: dto.approvedById,
          remarks: dto.remarks,
          externalRef: dto.externalRef,
        },
      });

      // 4. Create Double-Entry Ledger Entries
      let debitAccountName = '';
      let creditAccountName = '';

      switch (dto.type) {
        case TransactionType.DEPOSIT:
          debitAccountName = 'Branch Cash Vault Account';
          creditAccountName = `Customer Deposit Liability (${account.accountNumber})`;
          break;
        case TransactionType.WITHDRAWAL:
          debitAccountName = `Customer Deposit Liability (${account.accountNumber})`;
          creditAccountName = 'Branch Cash Vault Account';
          break;
        case TransactionType.COMPANY_FEE_DEDUCTION:
          debitAccountName = `Customer Savings (${account.accountNumber})`;
          creditAccountName = 'E-RIKON Fee Revenue Account';
          break;
        case TransactionType.LOAN_DISBURSEMENT:
          debitAccountName = `Loan Receivable Account (${account.accountNumber})`;
          creditAccountName = 'Branch Cash Vault Account';
          break;
        case TransactionType.LOAN_REPAYMENT:
          debitAccountName = 'Branch Cash Vault Account';
          creditAccountName = `Loan Receivable Account (${account.accountNumber})`;
          break;
        default:
          debitAccountName = 'General Ledger Account Debit';
          creditAccountName = 'General Ledger Account Credit';
      }

      await tx.ledgerEntry.createMany({
        data: [
          {
            transactionId: transaction.id,
            accountId: account.id,
            accountName: debitAccountName,
            entryType: EntryType.DEBIT,
            amount: dto.amount,
          },
          {
            transactionId: transaction.id,
            accountId: account.id,
            accountName: creditAccountName,
            entryType: EntryType.CREDIT,
            amount: dto.amount,
          },
        ],
      });

      // 5. Update Account Balance atomically
      const availableDiff =
        dto.type === TransactionType.WITHDRAWAL || dto.type === TransactionType.COMPANY_FEE_DEDUCTION
          ? -dto.amount
          : dto.amount;

      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          currentBalance: newBal,
          availableBalance: { increment: availableDiff },
        },
      });

      // 6. Record Immutable Audit Log
      await tx.auditLog.create({
        data: {
          userId: dto.recordedById,
          branchName: account.branch.name,
          action: `FINANCIAL_${dto.type}_RECORDED`,
          resource: 'TRANSACTION',
          previousValue: `Balance GHS ${previousBal}`,
          newValue: `Balance GHS ${newBal} (Tx: ${referenceNo})`,
          ipAddress: dto.ipAddress || '127.0.0.1',
        },
      });

      return {
        transaction,
        account: updatedAccount,
        receiptNo,
        referenceNo,
      };
    });
  }

  async getAccountTransactions(accountId: string) {
    return this.prisma.transaction.findMany({
      where: { accountId },
      include: {
        recordedBy: { select: { firstName: true, lastName: true, role: true } },
        ledgerEntries: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBranchTransactions(branchId: string) {
    return this.prisma.transaction.findMany({
      where: { branchId },
      include: {
        account: { include: { customer: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
