const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all financial receipts, transactions, and resetting balances in Neon DB...');
  
  // Delete all ledger entries and transactions
  await prisma.ledgerEntry.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.auditLog.deleteMany({});
  
  // Reset account balances to 0.00
  await prisma.account.updateMany({
    data: {
      currentBalance: 0.00,
      availableBalance: 0.00,
    }
  });

  // Reset daily collection cycles
  await prisma.dailyCollectionCycle.updateMany({
    data: {
      currentDayCount: 0,
      totalDeposited: 0.00,
      feeDeducted: false,
      companyFeeAmount: 0.00,
      isCompleted: false,
    }
  });

  console.log('✅ Neon Database financial statement receipts and transactions cleared successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
