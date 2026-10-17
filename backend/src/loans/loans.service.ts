import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FinancialCalculatorService } from '../common/financial-calculator.service';
import { TransactionsService } from '../transactions/transactions.service';
import { LoanStatus, TransactionType, PaymentMode } from '@prisma/client';
import { EventsService } from '../events/events.service';

export interface ApplyLoanDto {
  customerId: string;
  accountId: string;
  productId: string;
  amountRequested: number;
  tenorDays: number;
  purpose: string;
  collaterals?: { itemType: string; description: string; estimatedValue: number }[];
  guarantors?: { fullName: string; phone: string; ghanaCardNumber: string; address: string; relationship: string; guaranteedAmount: number }[];
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: FinancialCalculatorService,
    private readonly transactionsService: TransactionsService,
    private readonly eventsService: EventsService,
  ) {}

  async calculateLoanQuote(amount: number, tenorDays: number) {
    return this.calculator.calculateErFastLoan(amount, tenorDays);
  }

  async applyForLoan(dto: ApplyLoanDto, officerId: string) {
    const calc = this.calculator.calculateErFastLoan(dto.amountRequested, dto.tenorDays);
    const appNo = `LN-APP-${Date.now().toString().slice(-6)}`;

    const loan = await this.prisma.loanApplication.create({
      data: {
        applicationNo: appNo,
        customerId: dto.customerId,
        accountId: dto.accountId,
        productId: dto.productId,
        amountRequested: dto.amountRequested,
        amountApproved: dto.amountRequested,
        tenorCategory: calc.tenorCategory,
        tenorValueDays: dto.tenorDays,
        interestRate: calc.interestRate * 100,
        totalInterest: calc.interestAmount,
        totalRepayable: calc.totalRepayable,
        outstandingBal: calc.totalRepayable,
        purpose: dto.purpose,
        status: LoanStatus.PENDING_REVIEW,
        collaterals: { create: dto.collaterals || [] },
        loanGuarantors: { create: dto.guarantors || [] },
        schedules: {
          create: calc.installments.map((inst) => ({
            installmentNo: inst.installmentNo,
            dueDate: inst.dueDate,
            principalDue: inst.principalDue,
            interestDue: inst.interestDue,
            totalDue: inst.totalDue,
          })),
        },
      },
      include: {
        customer: true,
        schedules: true,
        collaterals: true,
        loanGuarantors: true,
      },
    });

    // Broadcast to all connected SSE clients
    this.eventsService.broadcast('LOAN_CREATED', {
      applicationNo: appNo,
      customerId: dto.customerId,
      amountRequested: dto.amountRequested,
    });

    return loan;
  }

  async approveLoan(loanId: string, approverId: string) {
    const loan = await this.prisma.loanApplication.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan application not found');

    if (loan.status !== LoanStatus.PENDING_REVIEW) {
      throw new BadRequestException(`Loan is in status ${loan.status} and cannot be approved.`);
    }

    const approvedLoan = await this.prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.APPROVED,
        approvedById: approverId,
      },
    });

    // Broadcast to all connected SSE clients
    this.eventsService.broadcast('LOAN_APPROVED', { loanId, approverId });

    return approvedLoan;
  }

  async disburseLoan(loanId: string, disburserId: string, branchId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      include: { account: true },
    });
    if (!loan) throw new NotFoundException('Loan application not found');

    if (loan.status !== LoanStatus.APPROVED) {
      throw new BadRequestException('Loan must be APPROVED before disbursement.');
    }

    // Process Financial Transaction for Disbursement
    await this.transactionsService.processFinancialTransaction({
      accountId: loan.accountId,
      branchId,
      type: TransactionType.LOAN_DISBURSEMENT,
      paymentMode: PaymentMode.PHYSICAL_CASH,
      amount: Number(loan.amountRequested),
      recordedById: disburserId,
      remarks: `Disbursement for Loan ${loan.applicationNo}`,
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + loan.tenorValueDays);

    const disbursedLoan = await this.prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.DISBURSED,
        disbursedAt: new Date(),
        dueDate,
      },
    });

    // Broadcast to all connected SSE clients
    this.eventsService.broadcast('LOAN_DISBURSED', { loanId, amount: Number(loan.amountRequested) });

    return disbursedLoan;
  }

  async recordRepayment(loanId: string, amount: number, recorderId: string, branchId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      include: { schedules: { orderBy: { installmentNo: 'asc' } } },
    });
    if (!loan) throw new NotFoundException('Loan not found');

    const curBal = Number(loan.outstandingBal);
    if (amount > curBal) {
      throw new BadRequestException(`Repayment GHS ${amount} exceeds outstanding loan balance GHS ${curBal}`);
    }

    // 1. Process Financial Transaction
    await this.transactionsService.processFinancialTransaction({
      accountId: loan.accountId,
      branchId,
      type: TransactionType.LOAN_REPAYMENT,
      paymentMode: PaymentMode.PHYSICAL_CASH,
      amount,
      recordedById: recorderId,
      remarks: `Loan Repayment for Application ${loan.applicationNo}`,
    });

    const newOutstanding = curBal - amount;
    const isFullyPaid = newOutstanding <= 0.01;

    // 2. Batch compute schedule updates in-memory to avoid N+1 query roundtrips
    let remainingAmount = amount;
    const fullyPaidScheduleIds: string[] = [];
    let partialUpdate: { id: string; increment: number } | null = null;

    for (const schedule of loan.schedules) {
      if (remainingAmount <= 0) break;
      if (schedule.isPaid) continue;

      const due = Number(schedule.totalDue) - (Number(schedule.principalPaid) + Number(schedule.interestPaid));
      if (remainingAmount >= due) {
        fullyPaidScheduleIds.push(schedule.id);
        remainingAmount -= due;
      } else {
        partialUpdate = {
          id: schedule.id,
          increment: remainingAmount,
        };
        remainingAmount = 0;
      }
    }

    // Execute schedule updates and loan application update in a single atomic transaction
    const repaidLoan = await this.prisma.$transaction(async (tx) => {
      // Batch update all fully paid schedules in 1 query
      if (fullyPaidScheduleIds.length > 0) {
        await tx.loanSchedule.updateMany({
          where: { id: { in: fullyPaidScheduleIds } },
          data: {
            isPaid: true,
            paidAt: new Date(),
          },
        });
      }

      // Single update for partial schedule if any
      if (partialUpdate) {
        await tx.loanSchedule.update({
          where: { id: partialUpdate.id },
          data: {
            principalPaid: { increment: partialUpdate.increment },
          },
        });
      }

      // Update parent loan status and outstanding balance
      return tx.loanApplication.update({
        where: { id: loanId },
        data: {
          outstandingBal: newOutstanding,
          status: isFullyPaid ? LoanStatus.FULLY_PAID : LoanStatus.ACTIVE,
        },
      });
    });

    // Broadcast to all connected SSE clients
    this.eventsService.broadcast('LOAN_REPAYMENT_RECORDED', { loanId, amount, isFullyPaid });

    return repaidLoan;
  }

  /**
   * Optimized Portfolio Summary using Database Aggregation
   * Eliminates full-table fetch & in-memory iteration (solves N+1 and O(N) memory load)
   */
  async getLoanPortfolioSummary() {
    const [aggregates, inArrearsCount, totalLoans, recentLoans] = await Promise.all([
      this.prisma.loanApplication.aggregate({
        _sum: {
          amountRequested: true,
          outstandingBal: true,
        },
      }),
      this.prisma.loanApplication.count({
        where: { status: LoanStatus.IN_ARREARS },
      }),
      this.prisma.loanApplication.count(),
      this.prisma.loanApplication.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true, ghanaCardNumber: true } },
          product: { select: { name: true, code: true } },
        },
      }),
    ]);

    const totalDisbursed = Number(aggregates._sum.amountRequested || 0);
    const totalOutstanding = Number(aggregates._sum.outstandingBal || 0);
    const totalRepaid = Math.max(0, totalDisbursed - totalOutstanding);

    return {
      totalLoans,
      totalDisbursed,
      totalOutstanding,
      totalRepaid,
      inArrearsCount,
      loans: recentLoans,
    };
  }
}
