import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FinancialCalculatorService } from '../common/financial-calculator.service';
import { TransactionsService } from '../transactions/transactions.service';
import { LoanStatus, TransactionType, PaymentMode } from '@prisma/client';

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
    private readonly transactionsService: TransactionsService
  ) {}

  async calculateLoanQuote(amount: number, tenorDays: number) {
    return this.calculator.calculateErFastLoan(amount, tenorDays);
  }

  async applyForLoan(dto: ApplyLoanDto, officerId: string) {
    const calc = this.calculator.calculateErFastLoan(dto.amountRequested, dto.tenorDays);

    const appNo = `LN-APP-${Date.now().toString().slice(-6)}`;

    return this.prisma.loanApplication.create({
      data: {
        applicationNo: appNo,
        customerId: dto.customerId,
        accountId: dto.accountId,
        productId: dto.productId,
        amountRequested: dto.amountRequested,
        amountApproved: dto.amountRequested,
        tenorCategory: calc.tenorCategory,
        tenorValueDays: dto.tenorDays,
        interestRate: calc.interestRate * 100, // percentage e.g. 10, 15, 25, 30
        totalInterest: calc.interestAmount,
        totalRepayable: calc.totalRepayable,
        outstandingBal: calc.totalRepayable,
        purpose: dto.purpose,
        status: LoanStatus.PENDING_REVIEW,
        collaterals: {
          create: dto.collaterals || [],
        },
        loanGuarantors: {
          create: dto.guarantors || [],
        },
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
  }

  async approveLoan(loanId: string, approverId: string) {
    const loan = await this.prisma.loanApplication.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan application not found');

    if (loan.status !== LoanStatus.PENDING_REVIEW) {
      throw new BadRequestException(`Loan is in status ${loan.status} and cannot be approved.`);
    }

    return this.prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.APPROVED,
        approvedById: approverId,
      },
    });
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

    return this.prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.DISBURSED,
        disbursedAt: new Date(),
        dueDate,
      },
    });
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

    // 2. Update schedule statuses
    let remainingAmount = amount;
    for (const schedule of loan.schedules) {
      if (remainingAmount <= 0) break;
      if (schedule.isPaid) continue;

      const due = Number(schedule.totalDue) - (Number(schedule.principalPaid) + Number(schedule.interestPaid));
      if (remainingAmount >= due) {
        await this.prisma.loanSchedule.update({
          where: { id: schedule.id },
          data: {
            principalPaid: schedule.principalDue,
            interestPaid: schedule.interestDue,
            isPaid: true,
            paidAt: new Date(),
          },
        });
        remainingAmount -= due;
      } else {
        await this.prisma.loanSchedule.update({
          where: { id: schedule.id },
          data: {
            principalPaid: { increment: remainingAmount },
          },
        });
        remainingAmount = 0;
      }
    }

    return this.prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        outstandingBal: newOutstanding,
        status: isFullyPaid ? LoanStatus.FULLY_PAID : LoanStatus.ACTIVE,
      },
    });
  }

  async getLoanPortfolioSummary() {
    const loans = await this.prisma.loanApplication.findMany({
      include: { customer: true, product: true },
    });

    const totalDisbursed = loans.reduce((acc, l) => acc + Number(l.amountRequested), 0);
    const totalOutstanding = loans.reduce((acc, l) => acc + Number(l.outstandingBal), 0);
    const totalRepaid = totalDisbursed - totalOutstanding;

    const inArrearsCount = loans.filter((l) => l.status === LoanStatus.IN_ARREARS).length;

    return {
      totalLoans: loans.length,
      totalDisbursed,
      totalOutstanding,
      totalRepaid,
      inArrearsCount,
      loans,
    };
  }
}
