import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { TransactionsService, CreateTransactionDto } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async processTransaction(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.processFinancialTransaction(dto);
  }

  @Get('account/:accountId')
  async getAccountTx(@Param('accountId') accountId: string) {
    return this.transactionsService.getAccountTransactions(accountId);
  }

  @Get('branch/:branchId')
  async getBranchTx(@Param('branchId') branchId: string) {
    return this.transactionsService.getBranchTransactions(branchId);
  }
}
