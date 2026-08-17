import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ECFMS Clean Database Initialization...');

  // 1. Create Core Physical Branches
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

  const takoradiBranch = await prisma.branch.upsert({
    where: { code: 'BR-TAK-03' },
    update: {},
    create: {
      code: 'BR-TAK-03',
      name: 'Takoradi Market Circle Branch',
      address: '05 Liberation Road',
      city: 'Takoradi',
      region: 'Western',
      phone: '+233 31 200 5566',
      cashLimit: 120000.00,
    },
  });

  console.log('✅ Branches initialized:', accraBranch.name, kumasiBranch.name, takoradiBranch.name);

  // 2. Create Core Loan Product (ER-Fast Loan)
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

  console.log('✅ Loan product initialized:', erFastLoan.name);
  console.log('✅ Clean Database Initialization completed. 0 dummy users or customers.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
