import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from './common/prisma.service';
import { FinancialCalculatorService } from './common/financial-calculator.service';
import { DataLoaderService } from './common/data-loader.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { CustomersService } from './customers/customers.service';
import { CustomersController } from './customers/customers.controller';
import { TransactionsService } from './transactions/transactions.service';
import { TransactionsController } from './transactions/transactions.controller';
import { LoansService } from './loans/loans.service';
import { LoansController } from './loans/loans.controller';
import { ReportsService } from './reports/reports.service';
import { ReportsController } from './reports/reports.controller';
import { AuditService } from './audit/audit.service';
import { AuditController } from './audit/audit.controller';
import { BranchesService } from './branches/branches.service';
import { BranchesController } from './branches/branches.controller';
import { EventsModule } from './events/events.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ERIKON_CORE_FINANCIAL_SUPER_SECRET_KEY_2026',
      signOptions: { expiresIn: '12h' },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 seconds window
        limit: 100, // 100 requests per minute by default
      },
      {
        name: 'strict',
        ttl: 60000,
        limit: 10, // 10 requests per minute for sensitive endpoints (auth / brute force protection)
      },
      {
        name: 'financial',
        ttl: 60000,
        limit: 30, // 30 requests per minute for high-value financial actions
      },
    ]),
    EventsModule,
    SyncModule,
  ],
  controllers: [
    AuthController,
    CustomersController,
    TransactionsController,
    LoansController,
    ReportsController,
    AuditController,
    BranchesController,
  ],
  providers: [
    PrismaService,
    FinancialCalculatorService,
    DataLoaderService,
    AuthService,
    CustomersService,
    TransactionsService,
    LoansService,
    ReportsService,
    AuditService,
    BranchesService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
