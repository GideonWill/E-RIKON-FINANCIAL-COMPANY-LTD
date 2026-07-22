import { User, Customer, Account, Transaction, LoanApplication, AuditLog, Branch, RoleName } from '../types';

// Pre-seeded Initial State
export const MOCK_BRANCHES: Branch[] = [
  {
    id: 'br-01',
    code: 'BR-ACC-01',
    name: 'Accra Central Main Branch',
    address: '14 Independence Avenue, Ridge',
    city: 'Accra',
    region: 'Greater Accra',
    phone: '+233 30 200 1122',
    cashLimit: 250000.00,
    isActive: true,
  },
  {
    id: 'br-02',
    code: 'BR-KMS-02',
    name: 'Kumasi Adum Branch',
    address: '28 Prempeh II Street',
    city: 'Kumasi',
    region: 'Ashanti',
    phone: '+233 32 200 3344',
    cashLimit: 150000.00,
    isActive: true,
  },
  {
    id: 'br-03',
    code: 'BR-TAK-03',
    name: 'Takoradi Market Circle Branch',
    address: '05 Liberation Road',
    city: 'Takoradi',
    region: 'Western',
    phone: '+233 31 200 5566',
    cashLimit: 120000.00,
    isActive: true,
  },
];

export const MOCK_USERS: Record<RoleName, User> = {
  SUPER_ADMIN: {
    id: 'user-01',
    employeeId: 'EMP-001',
    firstName: 'Kwame',
    lastName: 'Mensah',
    email: 'admin@erikon-group.com',
    phone: '+233 24 411 2233',
    role: 'SUPER_ADMIN',
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
  },
  BRANCH_ADMIN: {
    id: 'user-02',
    employeeId: 'EMP-003',
    firstName: 'Esi',
    lastName: 'Quansah',
    email: 'branch.admin@erikon-group.com',
    phone: '+233 24 333 4455',
    role: 'BRANCH_ADMIN',
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
  },
  TELLER: {
    id: 'user-03',
    employeeId: 'EMP-005',
    firstName: 'Abena',
    lastName: 'Osei',
    email: 'teller@erikon-group.com',
    phone: '+233 24 555 6677',
    role: 'TELLER',
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
  },
  FIELD_OFFICER: {
    id: 'user-04',
    employeeId: 'EMP-009',
    firstName: 'Kofi',
    lastName: 'Appiah',
    email: 'field.officer@erikon-group.com',
    phone: '+233 24 999 8877',
    role: 'FIELD_OFFICER',
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
  },
  LOAN_OFFICER: {
    id: 'user-05',
    employeeId: 'EMP-012',
    firstName: 'Ama',
    lastName: 'Sarpong',
    email: 'loan.officer@erikon-group.com',
    phone: '+233 20 123 4567',
    role: 'LOAN_OFFICER',
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
  },
  AUDITOR: {
    id: 'user-06',
    employeeId: 'EMP-020',
    firstName: 'Yaw',
    lastName: 'Boateng',
    email: 'auditor@erikon-group.com',
    phone: '+233 50 888 9900',
    role: 'AUDITOR',
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
  },
};

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-01',
    customerNumber: 'CUST-2026-001',
    firstName: 'Kwadwo',
    lastName: 'Adjei',
    otherNames: 'Bernard',
    dateOfBirth: '1988-05-14',
    gender: 'Male',
    phone: '+233 24 100 2030',
    email: 'kwadwo.adjei@example.com',
    address: 'Plot 12, Osu RE, Accra',
    ghanaCardNumber: 'GHA-722104918-3',
    passportPhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    signatureUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200',
    ghanaCardFrontUrl: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&q=80&w=400',
    occupation: 'Trader & Retailer',
    monthlyIncome: 4500.00,
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
    status: 'VERIFIED',
    createdAt: '2026-01-10T08:30:00Z',
    nextOfKin: {
      id: 'nok-01',
      fullName: 'Mercy Adjei',
      relationship: 'Spouse',
      phone: '+233 24 100 9988',
      address: 'Plot 12, Osu RE, Accra',
      occupation: 'Teacher',
    },
    guarantors: [
      {
        id: 'gua-01',
        fullName: 'Samuel Mensah',
        phone: '+233 20 444 5566',
        ghanaCardNumber: 'GHA-891048123-9',
        address: 'Adabraka, Accra',
        relationship: 'Business Partner',
        monthlyIncome: 6000.00,
      },
    ],
  },
  {
    id: 'cust-02',
    customerNumber: 'CUST-2026-002',
    firstName: 'Akosua',
    lastName: 'Frimpong',
    otherNames: 'Grace',
    dateOfBirth: '1992-11-22',
    gender: 'Female',
    phone: '+233 27 333 9900',
    email: 'akosua.frimpong@example.com',
    address: 'House 8, East Legon, Accra',
    ghanaCardNumber: 'GHA-109283748-5',
    passportPhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
    occupation: 'Fashion Designer',
    monthlyIncome: 8200.00,
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
    status: 'VERIFIED',
    createdAt: '2026-02-01T10:15:00Z',
    nextOfKin: {
      id: 'nok-02',
      fullName: 'Francis Frimpong',
      relationship: 'Brother',
      phone: '+233 27 444 8811',
      address: 'East Legon, Accra',
    },
  },
];

export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 'acc-01',
    accountNumber: 'ACC-1001-0891',
    customerId: 'cust-01',
    customer: INITIAL_CUSTOMERS[0],
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
    type: 'SAVINGS',
    currentBalance: 3100.00,
    availableBalance: 3000.00, // 30 days available, 1 day company fee deducted (31-day policy)
    interestRate: 0.00,
    status: 'ACTIVE',
    openingDate: '2026-01-10T09:00:00Z',
    dailyCycles: [
      {
        id: 'cyc-01',
        cycleNumber: 1,
        currentDayCount: 31,
        dailyTargetAmount: 100.00,
        totalDeposited: 3100.00,
        feeDeducted: true,
        companyFeeAmount: 100.00,
        isCompleted: true,
      },
    ],
  },
  {
    id: 'acc-02',
    accountNumber: 'ACC-1001-4432',
    customerId: 'cust-02',
    customer: INITIAL_CUSTOMERS[1],
    branchId: 'br-01',
    branch: MOCK_BRANCHES[0],
    type: 'SAVINGS',
    currentBalance: 1850.00,
    availableBalance: 1850.00,
    interestRate: 0.00,
    status: 'ACTIVE',
    openingDate: '2026-02-01T11:00:00Z',
    dailyCycles: [
      {
        id: 'cyc-02',
        cycleNumber: 1,
        currentDayCount: 18,
        dailyTargetAmount: 100.00,
        totalDeposited: 1850.00,
        feeDeducted: false,
        companyFeeAmount: 0.00,
        isCompleted: false,
      },
    ],
  },
];

export const INITIAL_LOANS: LoanApplication[] = [
  {
    id: 'loan-01',
    applicationNo: 'LN-APP-2026-901',
    customerId: 'cust-01',
    customer: INITIAL_CUSTOMERS[0],
    accountId: 'acc-01',
    productId: 'lp-01',
    amountRequested: 5000.00,
    amountApproved: 5000.00,
    tenorCategory: '1_MONTH_TO_3_MONTHS',
    tenorValueDays: 90,
    interestRate: 15,
    totalInterest: 750.00,
    totalRepayable: 5750.00,
    outstandingBal: 3833.33,
    purpose: 'Shop Inventory Expansion',
    status: 'DISBURSED',
    disbursedAt: '2026-05-01T10:00:00Z',
    dueDate: '2026-08-01T10:00:00Z',
    createdAt: '2026-04-28T09:00:00Z',
    schedules: [
      { id: 'sch-01', installmentNo: 1, dueDate: '2026-06-01', principalDue: 1666.67, interestDue: 250.00, totalDue: 1916.67, principalPaid: 1666.67, interestPaid: 250.00, isPaid: true },
      { id: 'sch-02', installmentNo: 2, dueDate: '2026-07-01', principalDue: 1666.67, interestDue: 250.00, totalDue: 1916.67, principalPaid: 0.00, interestPaid: 0.00, isPaid: false },
      { id: 'sch-03', installmentNo: 3, dueDate: '2026-08-01', principalDue: 1666.66, interestDue: 250.00, totalDue: 1916.66, principalPaid: 0.00, interestPaid: 0.00, isPaid: false },
    ],
  },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-01',
    referenceNo: 'TX-DEP-20260721-001',
    receiptNo: 'RCP-20260721-8891',
    accountId: 'acc-01',
    account: INITIAL_ACCOUNTS[0],
    type: 'DEPOSIT',
    paymentMode: 'PHYSICAL_CASH',
    amount: 100.00,
    previousBal: 3000.00,
    newBal: 3100.00,
    recordedBy: MOCK_USERS.FIELD_OFFICER,
    remarks: 'Daily 31-day collection contribution (Day 31)',
    createdAt: '2026-07-21T14:20:00Z',
  },
  {
    id: 'tx-02',
    referenceNo: 'TX-FEE-20260721-002',
    receiptNo: 'RCP-FEE-20260721-002',
    accountId: 'acc-01',
    account: INITIAL_ACCOUNTS[0],
    type: 'COMPANY_FEE_DEDUCTION',
    paymentMode: 'PHYSICAL_CASH',
    amount: 100.00,
    previousBal: 3100.00,
    newBal: 3000.00,
    recordedBy: MOCK_USERS.SUPER_ADMIN,
    remarks: 'E-RIKON 31-Day Policy management fee retention',
    createdAt: '2026-07-21T14:21:00Z',
  },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-01',
    userId: 'user-04',
    userEmail: 'field.officer@erikon-group.com',
    userRole: 'FIELD_OFFICER',
    branchName: 'Accra Central Main Branch',
    action: 'PHYSICAL_DEPOSIT_RECORDED',
    resource: 'TRANSACTION',
    previousValue: 'Balance GHS 3000.00',
    newValue: 'Balance GHS 3100.00 (Tx: TX-DEP-20260721-001)',
    ipAddress: '192.168.1.45',
    createdAt: '2026-07-21T14:20:05Z',
  },
  {
    id: 'aud-02',
    userId: 'user-01',
    userEmail: 'admin@erikon-group.com',
    userRole: 'SUPER_ADMIN',
    branchName: 'Accra Central Main Branch',
    action: 'COMPANY_FEE_RETENTION_31DAY_POLICY',
    resource: 'ACCOUNT',
    previousValue: 'Available GHS 3100.00',
    newValue: 'Available GHS 3000.00 (Fee: GHS 100.00 Retained)',
    ipAddress: '192.168.1.10',
    createdAt: '2026-07-21T14:21:05Z',
  },
];

// --- LOCALSTORAGE PERSISTENCE HELPERS ---

export const getStoredCustomers = (): Customer[] => {
  const data = localStorage.getItem('erikon_customers');
  if (!data) {
    localStorage.setItem('erikon_customers', JSON.stringify(INITIAL_CUSTOMERS));
    return INITIAL_CUSTOMERS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_CUSTOMERS;
  }
};

export const saveStoredCustomers = (customers: Customer[]) => {
  localStorage.setItem('erikon_customers', JSON.stringify(customers));
};

export const getStoredAccounts = (): Account[] => {
  const data = localStorage.getItem('erikon_accounts');
  if (!data) {
    localStorage.setItem('erikon_accounts', JSON.stringify(INITIAL_ACCOUNTS));
    return INITIAL_ACCOUNTS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_ACCOUNTS;
  }
};

export const saveStoredAccounts = (accounts: Account[]) => {
  localStorage.setItem('erikon_accounts', JSON.stringify(accounts));
};

export const getStoredLoans = (): LoanApplication[] => {
  const data = localStorage.getItem('erikon_loans');
  if (!data) {
    localStorage.setItem('erikon_loans', JSON.stringify(INITIAL_LOANS));
    return INITIAL_LOANS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_LOANS;
  }
};

export const saveStoredLoans = (loans: LoanApplication[]) => {
  localStorage.setItem('erikon_loans', JSON.stringify(loans));
};

export const getStoredTransactions = (): Transaction[] => {
  const data = localStorage.getItem('erikon_transactions');
  if (!data) {
    localStorage.setItem('erikon_transactions', JSON.stringify(INITIAL_TRANSACTIONS));
    return INITIAL_TRANSACTIONS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_TRANSACTIONS;
  }
};

export const saveStoredTransactions = (txs: Transaction[]) => {
  localStorage.setItem('erikon_transactions', JSON.stringify(txs));
};

// Aliases for initial load compatibility
export const MOCK_CUSTOMERS = getStoredCustomers();
export const MOCK_ACCOUNTS = getStoredAccounts();
export const MOCK_LOANS = getStoredLoans();
export const MOCK_TRANSACTIONS = getStoredTransactions();
