import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TransactionsService, CreateTransactionDto } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Protected against duplicate posting and rapid double-click submissions
   * Rate Limit: Max 30 financial transactions per minute
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post()
  async processTransaction(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.processFinancialTransaction(dto);
  }

  @Get('account/:accountId')
  async getAccountTx(
    @Param('accountId') accountId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string
  ) {
    return this.transactionsService.getAccountTransactions(
      accountId,
      take ? parseInt(take, 10) : 50,
      skip ? parseInt(skip, 10) : 0
    );
  }

  @Get('branch/:branchId')
  async getBranchTx(
    @Param('branchId') branchId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string
  ) {
    return this.transactionsService.getBranchTransactions(
      branchId,
      take ? parseInt(take, 10) : 100,
      skip ? parseInt(skip, 10) : 0
    );
  }
}
