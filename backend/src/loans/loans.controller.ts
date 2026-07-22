import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { LoansService, ApplyLoanDto } from './loans.service';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get('quote')
  async getQuote(@Query('amount') amount: number, @Query('tenorDays') tenorDays: number) {
    return this.loansService.calculateLoanQuote(Number(amount), Number(tenorDays));
  }

  @Post('apply')
  async apply(@Body() dto: ApplyLoanDto, @Query('officerId') officerId: string) {
    return this.loansService.applyForLoan(dto, officerId);
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Body('approverId') approverId: string) {
    return this.loansService.approveLoan(id, approverId);
  }

  @Post(':id/disburse')
  async disburse(
    @Param('id') id: string,
    @Body('disburserId') disburserId: string,
    @Body('branchId') branchId: string
  ) {
    return this.loansService.disburseLoan(id, disburserId, branchId);
  }

  @Post(':id/repay')
  async repay(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('recorderId') recorderId: string,
    @Body('branchId') branchId: string
  ) {
    return this.loansService.recordRepayment(id, Number(amount), recorderId, branchId);
  }

  @Get('portfolio')
  async getPortfolio() {
    return this.loansService.getLoanPortfolioSummary();
  }
}
