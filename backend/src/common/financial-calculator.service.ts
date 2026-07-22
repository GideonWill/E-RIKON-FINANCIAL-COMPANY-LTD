import { Injectable, BadRequestException } from '@nestjs/common';

export enum TenorCategory {
  ONE_TO_FOUR_WEEKS = '1_DAY_TO_4_WEEKS',
  ONE_TO_THREE_MONTHS = '1_MONTH_TO_3_MONTHS',
  THREE_TO_SIX_MONTHS = '3_MONTHS_TO_6_MONTHS',
  SIX_TO_TWELVE_MONTHS = '6_MONTHS_TO_12_MONTHS',
}

export interface LoanCalculationResult {
  principal: number;
  tenorCategory: TenorCategory;
  tenorDays: number;
  interestRate: number; // e.g. 0.10, 0.15, 0.25, 0.30
  interestAmount: number;
  totalRepayable: number;
  installments: {
    installmentNo: number;
    dueDate: Date;
    principalDue: number;
    interestDue: number;
    totalDue: number;
  }[];
}

@Injectable()
export class FinancialCalculatorService {
  /**
   * E-RIKON ER-Fast Loan Interest Rate Logic:
   * 1 Day - 4 Weeks (up to 28 days) -> 10% (0.10)
   * 1 Month - 3 Months (29 to 90 days) -> 15% (0.15)
   * 3 Months - 6 Months (91 to 180 days) -> 25% (0.25)
   * 6 Months - 12 Months (181 to 365 days) -> 30% (0.30)
   */
  calculateErFastLoan(principal: number, tenorDays: number): LoanCalculationResult {
    if (principal <= 0) {
      throw new BadRequestException('Principal amount must be greater than 0.');
    }
    if (tenorDays <= 0 || tenorDays > 365) {
      throw new BadRequestException('Tenor must be between 1 day and 365 days.');
    }

    let tenorCategory: TenorCategory;
    let interestRate: number;

    if (tenorDays <= 28) {
      tenorCategory = TenorCategory.ONE_TO_FOUR_WEEKS;
      interestRate = 0.10; // 10%
    } else if (tenorDays <= 90) {
      tenorCategory = TenorCategory.ONE_TO_THREE_MONTHS;
      interestRate = 0.15; // 15%
    } else if (tenorDays <= 180) {
      tenorCategory = TenorCategory.THREE_TO_SIX_MONTHS;
      interestRate = 0.25; // 25%
    } else {
      tenorCategory = TenorCategory.SIX_TO_TWELVE_MONTHS;
      interestRate = 0.30; // 30%
    }

    const interestAmount = Number((principal * interestRate).toFixed(2));
    const totalRepayable = Number((principal + interestAmount).toFixed(2));

    // Calculate installment count based on tenor (weekly for <= 28 days, monthly for longer)
    const isWeekly = tenorDays <= 28;
    const numberOfInstallments = isWeekly ? Math.max(1, Math.ceil(tenorDays / 7)) : Math.max(1, Math.ceil(tenorDays / 30));

    const principalPerInstallment = Number((principal / numberOfInstallments).toFixed(2));
    const interestPerInstallment = Number((interestAmount / numberOfInstallments).toFixed(2));

    const installments = [];
    const startDate = new Date();

    for (let i = 1; i <= numberOfInstallments; i++) {
      const dueDate = new Date(startDate);
      if (isWeekly) {
        dueDate.setDate(dueDate.getDate() + i * 7);
      } else {
        dueDate.setDate(dueDate.getDate() + i * 30);
      }

      // Handle precision rounding on last installment
      const isLast = i === numberOfInstallments;
      const curPrincipal = isLast
        ? Number((principal - principalPerInstallment * (numberOfInstallments - 1)).toFixed(2))
        : principalPerInstallment;
      const curInterest = isLast
        ? Number((interestAmount - interestPerInstallment * (numberOfInstallments - 1)).toFixed(2))
        : interestPerInstallment;

      installments.push({
        installmentNo: i,
        dueDate,
        principalDue: curPrincipal,
        interestDue: curInterest,
        totalDue: Number((curPrincipal + curInterest).toFixed(2)),
      });
    }

    return {
      principal,
      tenorCategory,
      tenorDays,
      interestRate,
      interestAmount,
      totalRepayable,
      installments,
    };
  }

  /**
   * E-RIKON 31-Day Savings / Daily Collection Policy:
   * Daily contributions across 31 days.
   * Days 1 to 30 go to customer savings available balance.
   * Day 31 contribution (or 1 day's fee equivalent) is collected by the company as administrative fee.
   */
  calculate31DayCycleFee(dailyContributionAmount: number, totalDaysContributed: number) {
    const isCycleComplete = totalDaysContributed >= 31;
    const totalDeposited = Number((dailyContributionAmount * totalDaysContributed).toFixed(2));

    // Day 31 fee equivalent
    const companyFee = isCycleComplete ? Number(dailyContributionAmount.toFixed(2)) : 0;
    const clientAvailableSavings = Number((totalDeposited - companyFee).toFixed(2));

    return {
      totalDeposited,
      companyFee,
      clientAvailableSavings,
      isCycleComplete,
    };
  }
}
