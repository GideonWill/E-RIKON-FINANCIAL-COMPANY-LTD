import { FinancialCalculatorService, TenorCategory } from '../src/common/financial-calculator.service';

describe('FinancialCalculatorService (E-RIKON Business Rules)', () => {
  let calculator: FinancialCalculatorService;

  beforeEach(() => {
    calculator = new FinancialCalculatorService();
  });

  describe('31-Day Savings Policy', () => {
    it('should NOT deduct company fee for contributions under 31 days', () => {
      const result = calculator.calculate31DayCycleFee(100, 30);
      expect(result.isCycleComplete).toBe(false);
      expect(result.companyFee).toBe(0);
      expect(result.totalDeposited).toBe(3000);
      expect(result.clientAvailableSavings).toBe(3000);
    });

    it('should deduct 1 day fee (31st day contribution) on 31st contribution', () => {
      const result = calculator.calculate31DayCycleFee(100, 31);
      expect(result.isCycleComplete).toBe(true);
      expect(result.totalDeposited).toBe(3100);
      expect(result.companyFee).toBe(100);
      expect(result.clientAvailableSavings).toBe(3000);
    });
  });

  describe('ER-Fast Loan Tiered Tenor Rate Policy', () => {
    it('should assign 10% interest for 1 Day to 4 Weeks (28 days)', () => {
      const result = calculator.calculateErFastLoan(5000, 21);
      expect(result.tenorCategory).toBe(TenorCategory.ONE_TO_FOUR_WEEKS);
      expect(result.interestRate).toBe(0.10);
      expect(result.interestAmount).toBe(500);
      expect(result.totalRepayable).toBe(5500);
    });

    it('should assign 15% interest for 1 Month to 3 Months (29 to 90 days)', () => {
      const result = calculator.calculateErFastLoan(5000, 60);
      expect(result.tenorCategory).toBe(TenorCategory.ONE_TO_THREE_MONTHS);
      expect(result.interestRate).toBe(0.15);
      expect(result.interestAmount).toBe(750);
      expect(result.totalRepayable).toBe(5750);
    });

    it('should assign 25% interest for 3 Months to 6 Months (91 to 180 days)', () => {
      const result = calculator.calculateErFastLoan(5000, 120);
      expect(result.tenorCategory).toBe(TenorCategory.THREE_TO_SIX_MONTHS);
      expect(result.interestRate).toBe(0.25);
      expect(result.interestAmount).toBe(1250);
      expect(result.totalRepayable).toBe(6250);
    });

    it('should assign 30% interest for 6 Months to 12 Months (181 to 365 days)', () => {
      const result = calculator.calculateErFastLoan(5000, 300);
      expect(result.tenorCategory).toBe(TenorCategory.SIX_TO_TWELVE_MONTHS);
      expect(result.interestRate).toBe(0.30);
      expect(result.interestAmount).toBe(1500);
      expect(result.totalRepayable).toBe(6500);
    });
  });
});
