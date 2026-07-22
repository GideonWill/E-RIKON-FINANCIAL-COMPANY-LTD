export type RoleName = 
  | 'SUPER_ADMIN'
  | 'BRANCH_ADMIN'
  | 'TELLER'
  | 'FIELD_OFFICER'
  | 'LOAN_OFFICER'
  | 'AUDITOR';

export type CustomerStatus = 'PENDING' | 'VERIFIED' | 'ACTIVE' | 'DORMANT' | 'SUSPENDED' | 'CLOSED';

export type AccountType = 'SAVINGS' | 'CURRENT' | 'EDUCATION_FUND' | 'RETIREMENT_FUND' | 'LOAN_ACCOUNT';

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export type TransactionType = 
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'LOAN_DISBURSEMENT'
  | 'LOAN_REPAYMENT'
  | 'INTEREST_CHARGE'
  | 'COMPANY_FEE_DEDUCTION'
  | 'PENALTY_FEE';

export type PaymentMode = 'PHYSICAL_CASH' | 'MTN_MOBILE_MONEY' | 'BANK_TRANSFER';

export type LoanStatus = 
  | 'PENDING_REVIEW'
  | 'UNDER_EVALUATION'
  | 'APPROVED'
  | 'DISBURSED'
  | 'ACTIVE'
  | 'IN_ARREARS'
  | 'FULLY_PAID'
  | 'REJECTED';

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  region: string;
  phone: string;
  cashLimit: number;
  isActive: boolean;
}

export interface User {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: RoleName;
  branchId: string;
  branch?: Branch;
}

export interface Customer {
  id: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  address: string;
  ghanaCardNumber: string;
  passportPhotoUrl?: string;
  signatureUrl?: string;
  ghanaCardFrontUrl?: string;
  ghanaCardBackUrl?: string;
  occupation: string;
  employerName?: string;
  monthlyIncome?: number;
  branchId: string;
  branch?: Branch;
  status: CustomerStatus;
  createdAt: string;
  accounts?: Account[];
  nextOfKin?: NextOfKin;
  guarantors?: Guarantor[];
  timeline?: CustomerTimeline[];
}

export interface CustomerTimeline {
  id: string;
  title: string;
  description: string;
  performedBy: string;
  createdAt: string;
}

export interface NextOfKin {
  id: string;
  fullName: string;
  relationship: string;
  phone: string;
  address: string;
  occupation?: string;
}

export interface Guarantor {
  id: string;
  fullName: string;
  phone: string;
  ghanaCardNumber: string;
  address: string;
  relationship: string;
  monthlyIncome?: number;
}

export interface Account {
  id: string;
  accountNumber: string;
  customerId: string;
  customer?: Customer;
  branchId: string;
  branch?: Branch;
  type: AccountType;
  currentBalance: number;
  availableBalance: number;
  interestRate: number;
  status: AccountStatus;
  openingDate: string;
  dailyCycles?: DailyCollectionCycle[];
}

export interface DailyCollectionCycle {
  id: string;
  cycleNumber: number;
  currentDayCount: number; // 1 to 31
  dailyTargetAmount: number;
  totalDeposited: number;
  feeDeducted: boolean;
  companyFeeAmount: number;
  isCompleted: boolean;
}

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  description?: string;
}

export interface LoanApplication {
  id: string;
  applicationNo: string;
  customerId: string;
  customer?: Customer;
  accountId: string;
  productId: string;
  product?: LoanProduct;
  amountRequested: number;
  amountApproved: number;
  tenorCategory: string;
  tenorValueDays: number;
  interestRate: number; // percentage e.g. 10, 15, 25, 30
  totalInterest: number;
  totalRepayable: number;
  outstandingBal: number;
  purpose: string;
  status: LoanStatus;
  disbursedAt?: string;
  dueDate?: string;
  createdAt: string;
  schedules?: LoanSchedule[];
}

export interface LoanSchedule {
  id: string;
  installmentNo: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  principalPaid: number;
  interestPaid: number;
  isPaid: boolean;
}

export interface Transaction {
  id: string;
  referenceNo: string;
  receiptNo: string;
  accountId: string;
  account?: Account;
  type: TransactionType;
  paymentMode: PaymentMode;
  amount: number;
  previousBal: number;
  newBal: number;
  recordedBy?: User;
  remarks?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  branchName?: string;
  action: string;
  resource: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
  createdAt: string;
}
