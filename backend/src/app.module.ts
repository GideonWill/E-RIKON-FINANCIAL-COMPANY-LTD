import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './common/prisma.service';
import { FinancialCalculatorService } from './common/financial-calculator.service';
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

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ERIKON_CORE_FINANCIAL_SUPER_SECRET_KEY_2026',
      signOptions: { expiresIn: '12h' },
    }),
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
    AuthService,
    CustomersService,
    TransactionsService,
    LoansService,
    ReportsService,
    AuditService,
    BranchesService,
  ],
})
export class AppModule {}
