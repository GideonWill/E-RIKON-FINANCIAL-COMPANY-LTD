import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearData() {
  console.log('🧹 Clearing all customer data, transactions, loans, financial ledgers, and audit trails...');

  try {
    // 1. Delete double-entry ledger entries and transactions
    const deletedLedger = await prisma.ledgerEntry.deleteMany({});
    console.log(`✓ Deleted ${deletedLedger.count} ledger entries`);

    const deletedTx = await prisma.transaction.deleteMany({});
    console.log(`✓ Deleted ${deletedTx.count} transactions`);

    // 2. Delete loan schedules, collaterals, guarantors, and loan applications
    const deletedSchedules = await prisma.loanSchedule.deleteMany({});
    console.log(`✓ Deleted ${deletedSchedules.count} loan schedules`);

    const deletedCollaterals = await prisma.loanCollateral.deleteMany({});
    console.log(`✓ Deleted ${deletedCollaterals.count} loan collaterals`);

    const deletedLoanGuarantors = await prisma.loanGuarantor.deleteMany({});
    console.log(`✓ Deleted ${deletedLoanGuarantors.count} loan guarantors`);

    const deletedLoans = await prisma.loanApplication.deleteMany({});
    console.log(`✓ Deleted ${deletedLoans.count} loan applications`);

    // 3. Delete daily collection cycles and customer accounts
    const deletedCycles = await prisma.dailyCollectionCycle.deleteMany({});
    console.log(`✓ Deleted ${deletedCycles.count} daily collection cycles`);

    const deletedCustomerTimelines = await prisma.customerTimeline.deleteMany({});
    console.log(`✓ Deleted ${deletedCustomerTimelines.count} customer timelines`);

    const deletedCustomerDocs = await prisma.customerDocument.deleteMany({});
    console.log(`✓ Deleted ${deletedCustomerDocs.count} customer documents`);

    const deletedNextOfKin = await prisma.nextOfKin.deleteMany({});
    console.log(`✓ Deleted ${deletedNextOfKin.count} next-of-kin records`);

    const deletedGuarantors = await prisma.guarantor.deleteMany({});
    console.log(`✓ Deleted ${deletedGuarantors.count} guarantors`);

    const deletedAccounts = await prisma.account.deleteMany({});
    console.log(`✓ Deleted ${deletedAccounts.count} accounts`);

    // 4. Delete customers
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log(`✓ Deleted ${deletedCustomers.count} customers`);

    // 5. Delete financial statements & summaries
    const deletedDailyCash = await prisma.dailyCashSummary.deleteMany({});
    console.log(`✓ Deleted ${deletedDailyCash.count} daily cash summaries`);

    const deletedInterestAccumulations = await prisma.companyInterestAccumulation.deleteMany({});
    console.log(`✓ Deleted ${deletedInterestAccumulations.count} company interest accumulations`);

    const deletedInterestWithdrawals = await prisma.companyInterestWithdrawal.deleteMany({});
    console.log(`✓ Deleted ${deletedInterestWithdrawals.count} company interest withdrawals`);

    // 6. Delete immutable audit trails
    const deletedAuditLogs = await prisma.auditLog.deleteMany({});
    console.log(`✓ Deleted ${deletedAuditLogs.count} immutable audit logs`);

    // 7. Delete non-staff approval requests
    const deletedApprovals = await prisma.approvalRequest.deleteMany({
      where: {
        type: {
          not: 'STAFF_ROLE_SIGNUP',
        },
      },
    });
    console.log(`✓ Deleted ${deletedApprovals.count} customer/financial approval requests (preserved staff signups)`);

    console.log('✅ Database successfully cleared to fresh slate for new entries! (Branches, Staff Users, and Loan Products preserved)');
  } catch (error: any) {
    console.error('Error during data clearance:', error?.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
