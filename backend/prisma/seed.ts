import { PrismaClient, RoleName, CustomerStatus, AccountType, AccountStatus, TransactionType, PaymentMode, TransactionStatus, LoanStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ECFMS Database Seeding...');

  // 1. Create Branches
  const accraBranch = await prisma.branch.upsert({
    where: { code: 'BR-ACC-01' },
    update: {},
    create: {
      code: 'BR-ACC-01',
      name: 'Accra Central Main Branch',
      address: '14 Independence Avenue, Ridge',
      city: 'Accra',
      region: 'Greater Accra',
      phone: '+233 30 200 1122',
      cashLimit: 250000.00,
    },
  });

  const kumasiBranch = await prisma.branch.upsert({
    where: { code: 'BR-KMS-02' },
    update: {},
    create: {
      code: 'BR-KMS-02',
      name: 'Kumasi Adum Branch',
      address: '28 Prempeh II Street',
      city: 'Kumasi',
      region: 'Ashanti',
      phone: '+233 32 200 3344',
      cashLimit: 150000.00,
    },
  });

  console.log('✅ Branches created:', accraBranch.name, kumasiBranch.name);

  // 2. Create Default System Users with Roles
  const defaultPassword = await bcrypt.hash('Erikon@2026!', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@erikon-group.com' },
    update: {},
    create: {
      employeeId: 'EMP-001',
      firstName: 'Kwame',
      lastName: 'Mensah',
      email: 'admin@erikon-group.com',
      phone: '+233 24 411 2233',
      passwordHash: defaultPassword,
      role: RoleName.SUPER_ADMIN,
      branchId: accraBranch.id,
    },
  });

  const teller = await prisma.user.upsert({
    where: { email: 'teller.accra@erikon-group.com' },
    update: {},
    create: {
      employeeId: 'EMP-005',
      firstName: 'Abena',
      lastName: 'Osei',
      email: 'teller.accra@erikon-group.com',
      phone: '+233 24 555 6677',
      passwordHash: defaultPassword,
      role: RoleName.TELLER,
      branchId: accraBranch.id,
    },
  });

  const fieldOfficer = await prisma.user.upsert({
    where: { email: 'field.accra@erikon-group.com' },
    update: {},
    create: {
      employeeId: 'EMP-009',
      firstName: 'Kofi',
      lastName: 'Appiah',
      email: 'field.accra@erikon-group.com',
      phone: '+233 24 999 8877',
      passwordHash: defaultPassword,
      role: RoleName.FIELD_OFFICER,
      branchId: accraBranch.id,
    },
  });

  const loanOfficer = await prisma.user.upsert({
    where: { email: 'loan.accra@erikon-group.com' },
    update: {},
    create: {
      employeeId: 'EMP-012',
      firstName: 'Ama',
      lastName: 'Sarpong',
      email: 'loan.accra@erikon-group.com',
      phone: '+233 20 123 4567',
      passwordHash: defaultPassword,
      role: RoleName.LOAN_OFFICER,
      branchId: accraBranch.id,
    },
  });

  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@erikon-group.com' },
    update: {},
    create: {
      employeeId: 'EMP-020',
      firstName: 'Yaw',
      lastName: 'Boateng',
      email: 'auditor@erikon-group.com',
      phone: '+233 50 888 9900',
      passwordHash: defaultPassword,
      role: RoleName.AUDITOR,
      branchId: accraBranch.id,
    },
  });

  console.log('✅ Users created for all roles');

  // 3. Create Loan Products (ER-Fast Loan)
  const erFastLoan = await prisma.loanProduct.upsert({
    where: { code: 'LP-ER-FAST' },
    update: {},
    create: {
      code: 'LP-ER-FAST',
      name: 'ER-Fast Loan',
      minAmount: 500.00,
      maxAmount: 50000.00,
      description: 'Tiered tenor interest scheme: 10% (4wks), 15% (3m), 25% (6m), 30% (12m)',
    },
  });

  // 4. Create Sample Customer with 31-Day Savings & Ghana Card
  const customer1 = await prisma.customer.upsert({
    where: { customerNumber: 'CUST-2026-001' },
    update: {},
    create: {
      customerNumber: 'CUST-2026-001',
      firstName: 'Kwadwo',
      lastName: 'Adjei',
      gender: 'Male',
      dateOfBirth: new Date('1988-05-14'),
      phone: '+233 24 100 2030',
      email: 'kwadwo.adjei@example.com',
      address: 'House No 45, Osu RE, Accra',
      ghanaCardNumber: 'GHA-722104918-3',
      occupation: 'Trader & Retailer',
      monthlyIncome: 4500.00,
      branchId: accraBranch.id,
      createdById: fieldOfficer.id,
      status: CustomerStatus.VERIFIED,
    },
  });

  // Create Savings Account with 31-Day Cycle
  const savingsAccount = await prisma.account.upsert({
    where: { accountNumber: 'ACC-1001-0891' },
    update: {},
    create: {
      accountNumber: 'ACC-1001-0891',
      customerId: customer1.id,
      branchId: accraBranch.id,
      type: AccountType.SAVINGS,
      currentBalance: 3100.00,
      availableBalance: 3000.00, // 30 days kept, 1 day fee retained
      status: AccountStatus.ACTIVE,
    },
  });

  // Create 31-Day Cycle
  await prisma.dailyCollectionCycle.create({
    data: {
      customerId: customer1.id,
      accountId: savingsAccount.id,
      cycleNumber: 1,
      currentDayCount: 31,
      dailyTargetAmount: 100.00,
      totalDeposited: 3100.00,
      feeDeducted: true,
      companyFeeAmount: 100.00, // Day 31 retained as company fee
      isCompleted: true,
    },
  });

  // Create Initial Physical Cash Deposit Transaction
  const depositTx = await prisma.transaction.create({
    data: {
      referenceNo: 'TX-DEP-20260721-001',
      receiptNo: 'RCP-20260721-8891',
      accountId: savingsAccount.id,
      branchId: accraBranch.id,
      type: TransactionType.DEPOSIT,
      paymentMode: PaymentMode.PHYSICAL_CASH,
      amount: 3100.00,
      previousBal: 0.00,
      newBal: 3100.00,
      status: TransactionStatus.COMPLETED,
      recordedById: fieldOfficer.id,
      remarks: 'Daily collection total for 31-day savings cycle',
      ledgerEntries: {
        create: [
          {
            accountId: savingsAccount.id,
            accountName: 'Vault Cash Account',
            entryType: 'DEBIT',
            amount: 3100.00,
          },
          {
            accountId: savingsAccount.id,
            accountName: 'Customer Savings Liability Account',
            entryType: 'CREDIT',
            amount: 3100.00,
          },
        ],
      },
    },
  });

  // 31st Day Fee Retention Transaction
  await prisma.transaction.create({
    data: {
      referenceNo: 'TX-FEE-20260721-002',
      receiptNo: 'RCP-FEE-20260721-002',
      accountId: savingsAccount.id,
      branchId: accraBranch.id,
      type: TransactionType.COMPANY_FEE_DEDUCTION,
      paymentMode: PaymentMode.PHYSICAL_CASH,
      amount: 100.00,
      previousBal: 3100.00,
      newBal: 3000.00,
      status: TransactionStatus.COMPLETED,
      recordedById: superAdmin.id,
      remarks: 'E-RIKON 31-Day Policy interest & administrative fee deduction',
      ledgerEntries: {
        create: [
          {
            accountId: savingsAccount.id,
            accountName: 'Customer Savings Liability Account',
            entryType: 'DEBIT',
            amount: 100.00,
          },
          {
            accountId: savingsAccount.id,
            accountName: 'E-RIKON Company Fee Revenue Account',
            entryType: 'CREDIT',
            amount: 100.00,
          },
        ],
      },
    },
  });

  // Seed Audit Log
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      userEmail: superAdmin.email,
      userRole: superAdmin.role,
      branchName: accraBranch.name,
      action: 'SYSTEM_INITIALIZED',
      resource: 'SYSTEM',
      newValue: 'Core Banking Ledger and Initial Seed Data successfully provisioned.',
      ipAddress: '127.0.0.1',
      browser: 'Chrome 126',
      os: 'Windows 11',
    },
  });

  console.log('✅ Database Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
