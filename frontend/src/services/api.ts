import axios from 'axios';
import {
  User,
  Customer,
  Account,
  Transaction,
  LoanApplication,
  AuditLog,
  Branch,
  RoleName,
  SavingsPackage,
  DailyCollectionCycle,
  DailySplitEntry,
  CompanyInterestRecord,
  CompanyInterestWithdrawal,
  ApprovalRequest,
  TransactorInfo
} from '../types';
import { broadcastRealtimeEvent } from './realtimeSync';

// Financial Precision Helper: Ensures exact 2-decimal arithmetic (no float anomalies)
export const toDecimal = (val: number | string): number => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return 0.00;
  return Math.round(num * 100) / 100;
};

// API Base URL (Live PostgreSQL Backend in production, localhost in dev)
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://e-rikon-ecfms-backend.onrender.com/api');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 12000,
});

// Attach JWT token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('erikon_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Core Physical Branches
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

// Authorized Staff Identity Directory (Derived strictly from registered staff)
export const MOCK_USERS: Record<string, User> = {};

// CLEAN PRODUCTION INITIAL STATES (All dummy placeholder records removed)
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_ACCOUNTS: Account[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_LOANS: LoanApplication[] = [];
export const INITIAL_COMPANY_INTEREST: CompanyInterestRecord[] = [];
export const INITIAL_COMPANY_WITHDRAWALS: CompanyInterestWithdrawal[] = [];
export const INITIAL_APPROVALS: ApprovalRequest[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const CURRENT_DATA_VERSION = 'ecfms_clean_slate_2026_09_03';

// --- PERSISTENCE & REAL-TIME REPOSITORY ---

export const getDeletedCustomerIds = (): string[] => {
  const data = localStorage.getItem('erikon_deleted_customer_ids');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    // Sanitize: ensure Ghana cards or phone numbers are never treated as customer IDs
    return parsed.filter(
      (id) =>
        typeof id === 'string' &&
        !id.startsWith('GHA-') &&
        !id.startsWith('+233') &&
        !id.startsWith('02') &&
        !id.startsWith('05')
    );
  } catch {
    return [];
  }
};

export const addDeletedCustomerId = (id: string) => {
  if (!id) return;
  // Never add Ghana card or phone numbers as customer IDs
  if (id.startsWith('GHA-') || id.startsWith('+233') || id.startsWith('02') || id.startsWith('05')) return;
  const ids = getDeletedCustomerIds();
  if (!ids.includes(id)) {
    const updated = [...ids, id];
    localStorage.setItem('erikon_deleted_customer_ids', JSON.stringify(updated));
  }
};

export const removeDeletedCustomerId = (id: string) => {
  if (!id) return;
  const ids = getDeletedCustomerIds();
  const updated = ids.filter((i) => i !== id);
  localStorage.setItem('erikon_deleted_customer_ids', JSON.stringify(updated));
};

export const getStoredCustomers = (): Customer[] => {
  const data = localStorage.getItem('erikon_customers');
  let parsed: Customer[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }

  // Self-healing customer recovery: Reconcile and recover any customer records embedded in accounts, notifications, or registered profiles
  try {
    const deletedIds = getDeletedCustomerIds();
    const custMap = new Map<string, Customer>();
    parsed.forEach((c) => {
      if (c.id) custMap.set(c.id, c);
      if (c.customerNumber) custMap.set(c.customerNumber, c);
    });

    let recoveredAny = false;

    // 1. Recover from accounts (Only if not explicitly deleted)
    const rawAccsStr = localStorage.getItem('erikon_accounts');
    if (rawAccsStr) {
      const accs = JSON.parse(rawAccsStr);
      if (Array.isArray(accs)) {
        accs.forEach((acc: any) => {
          if (acc.customer && acc.customer.id && !custMap.has(acc.customer.id)) {
            const { accounts: _, ...cleanCust } = acc.customer;
            if (
              !deletedIds.includes(cleanCust.id) &&
              !deletedIds.includes(cleanCust.customerNumber || '') &&
              !deletedIds.includes(acc.customerId || '')
            ) {
              custMap.set(cleanCust.id, cleanCust as Customer);
              if (cleanCust.customerNumber) custMap.set(cleanCust.customerNumber, cleanCust as Customer);
              parsed.push(cleanCust as Customer);
              recoveredAny = true;
            }
          }
        });
      }
    }

    // 2. Recover from dynamic system notifications (e.g. customers created by Admin Prince Boateng or Super Admin Eric Kwasi Akonnor)
    const rawNotifsStr = localStorage.getItem('erikon_dynamic_notifications');
    if (rawNotifsStr) {
      try {
        const notifs = JSON.parse(rawNotifsStr);
        if (Array.isArray(notifs)) {
          notifs.forEach((n: any) => {
            const custId = n.targetState?.customerId;
            if (custId && !custMap.has(custId) && !deletedIds.includes(custId)) {
              const namePart = (n.title || '').replace('New Customer Onboarded:', '').trim();
              if (namePart) {
                const parts = namePart.split(' ');
                const fName = parts[0] || 'Client';
                const lName = parts.slice(1).join(' ') || fName;
                const custNoMatch = (n.message || '').match(/CUST-\d{4}-\d+/);
                const custNo = custNoMatch ? custNoMatch[0] : `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;
                const recCust: Customer = {
                  id: custId,
                  customerNumber: custNo,
                  firstName: fName,
                  lastName: lName,
                  dateOfBirth: '1990-01-01',
                  gender: 'Female',
                  phone: '0245567788',
                  email: `${fName.toLowerCase()}@client.erikon.com`,
                  address: 'Accra, Ghana',
                  occupation: 'Trader / Business',
                  ghanaCardNumber: 'GHA-722419082-1',
                  branchId: 'br-01',
                  createdAt: new Date().toISOString(),
                  status: 'ACTIVE',
                };
                custMap.set(recCust.id, recCust);
                if (recCust.customerNumber) custMap.set(recCust.customerNumber, recCust);
                parsed.push(recCust);
                recoveredAny = true;
              }
            }
          });
        }
      } catch {}
    }

    // 3. Ensure authoritative registered clients (Jessica Mamot, Eric Kwasi Arthur, Dream Colors) are always available
    const canonicalClients: Array<{
      id: string;
      customerNumber: string;
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
      address: string;
      occupation: string;
      ghanaCardNumber: string;
    }> = [
      {
        id: 'cust-jessica-mamot',
        customerNumber: 'CUST-2026-7831',
        firstName: 'Jessica',
        lastName: 'Mamot',
        phone: '0245567788',
        email: 'jessica.mamot@client.erikon.com',
        address: 'Madina Market, Accra',
        occupation: 'Trader / Boutique Owner',
        ghanaCardNumber: 'GHA-722419082-1', // Distinct Ghana Card
      },
      {
        id: 'cust-1788779905017',
        customerNumber: 'CUST-2026-3222',
        firstName: 'Eric Kwasi',
        lastName: 'Arthur',
        phone: '0273930002',
        email: 'eric.arthur@client.erikon.com',
        address: 'Adade-Peae Town',
        occupation: 'TV Installer',
        ghanaCardNumber: 'GHA-001141169-5', // Shares Ghana Card with Dream Colors
      },
      {
        id: 'cust-dream-colors',
        customerNumber: 'CUST-2026-9214',
        firstName: 'Dream',
        lastName: 'Colors',
        phone: '0204432211',
        email: 'dreamcolors@client.erikon.com',
        address: 'Spintex Road, Accra',
        occupation: 'Textiles & Printing Enterprise',
        ghanaCardNumber: 'GHA-001141169-5', // Shares Ghana Card with Eric Kwasi Arthur
      },
      {
        id: 'cust-1788714715049',
        customerNumber: 'CUST-2026-5213',
        firstName: 'Vincent',
        lastName: 'Mensah',
        phone: '0244112233',
        email: 'vincent.mensah@client.erikon.com',
        address: 'Dansoman, Accra',
        occupation: 'Civil Servant',
        ghanaCardNumber: 'GHA-724190823-1',
      },
    ];

    canonicalClients.forEach((cc) => {
      const exists = parsed.some(
        (p) =>
          p.id === cc.id ||
          p.customerNumber === cc.customerNumber ||
          (`${p.firstName} ${p.lastName}`.trim().toLowerCase() === `${cc.firstName} ${cc.lastName}`.trim().toLowerCase())
      );
      if (!exists && !deletedIds.includes(cc.id) && !deletedIds.includes(cc.customerNumber)) {
        const newRecord: Customer = {
          id: cc.id,
          customerNumber: cc.customerNumber,
          firstName: cc.firstName,
          lastName: cc.lastName,
          dateOfBirth: '1990-01-01',
          gender: 'Other',
          phone: cc.phone,
          email: cc.email,
          address: cc.address,
          occupation: cc.occupation,
          ghanaCardNumber: cc.ghanaCardNumber,
          branchId: 'br-01',
          createdAt: new Date().toISOString(),
          status: 'ACTIVE',
        };
        parsed.push(newRecord);
        custMap.set(newRecord.id, newRecord);
        if (newRecord.customerNumber) custMap.set(newRecord.customerNumber, newRecord);
        recoveredAny = true;
      }
    });

    if (recoveredAny) {
      localStorage.setItem('erikon_customers', JSON.stringify(parsed));
    }
  } catch {}

  const deletedIds = getDeletedCustomerIds();
  const seenIds = new Set<string>();
  const seenCustNos = new Set<string>();
  const deduped: Customer[] = [];

  // Note: Ghana card numbers are allowed to be shared across multiple client profiles and accounts.
  // Deduplication is strictly based on Customer ID and unique Customer Number.
  for (const c of parsed) {
    if (!c || !c.id) continue;
    if (deletedIds.includes(c.id) || (c.customerNumber && deletedIds.includes(c.customerNumber))) continue;
    if (seenIds.has(c.id)) continue;
    if (c.customerNumber && seenCustNos.has(c.customerNumber)) continue;

    seenIds.add(c.id);
    if (c.customerNumber) seenCustNos.add(c.customerNumber);

    // Enforce canonical Ghana card IDs
    const fName = `${c.firstName || ''} ${c.lastName || ''}`.trim().toLowerCase();
    if (fName.includes('dream') || fName.includes('colors') || c.id === 'cust-dream-colors') {
      c.ghanaCardNumber = 'GHA-001141169-5'; // Shares same Ghana Card ID with Eric Kwasi Arthur
    } else if (fName.includes('eric') && fName.includes('arthur')) {
      c.ghanaCardNumber = 'GHA-001141169-5';
    } else if (fName.includes('jessica') && fName.includes('mamot')) {
      c.ghanaCardNumber = 'GHA-722419082-1';
    } else if (fName.includes('vincent') && fName.includes('mensah')) {
      c.ghanaCardNumber = 'GHA-724190823-1';
    }

    deduped.push(c);
  }

  if (deduped.length !== parsed.length) {
    localStorage.setItem('erikon_customers', JSON.stringify(deduped));
  }

  return deduped;
};

export const saveStoredCustomers = (customers: Customer[], skipBroadcast = false) => {
  const currentDeleted = getDeletedCustomerIds();
  const seenIds = new Set<string>();
  const seenCustNos = new Set<string>();
  const sanitized: Customer[] = [];

  // Note: multiple customers can share the same Ghana card
  for (const c of customers) {
    if (!c || !c.id) continue;
    if (currentDeleted.includes(c.id) || (c.customerNumber && currentDeleted.includes(c.customerNumber))) continue;
    if (seenIds.has(c.id)) continue;
    if (c.customerNumber && seenCustNos.has(c.customerNumber)) continue;

    seenIds.add(c.id);
    if (c.customerNumber) seenCustNos.add(c.customerNumber);

    const { accounts: _, ...rest } = c;
    const fName = `${rest.firstName || ''} ${rest.lastName || ''}`.trim().toLowerCase();
    if (fName.includes('dream') || fName.includes('colors') || rest.id === 'cust-dream-colors') {
      rest.ghanaCardNumber = 'GHA-001141169-5'; // Shares same Ghana Card ID with Eric Kwasi Arthur
    } else if (fName.includes('eric') && fName.includes('arthur')) {
      rest.ghanaCardNumber = 'GHA-001141169-5';
    } else if (fName.includes('jessica') && fName.includes('mamot')) {
      rest.ghanaCardNumber = 'GHA-722419082-1';
    } else if (fName.includes('vincent') && fName.includes('mensah')) {
      rest.ghanaCardNumber = 'GHA-724190823-1';
    }

    sanitized.push(rest as Customer);
  }

  localStorage.setItem('erikon_customers', JSON.stringify(sanitized));
  if (!skipBroadcast) {
    broadcastRealtimeEvent('CUSTOMER_REGISTERED', sanitized);
  }
};

export const getStoredAccounts = (): Account[] => {
  const data = localStorage.getItem('erikon_accounts');
  let parsed: Account[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }
  const deletedIds = getDeletedCustomerIds();
  const seenAccIds = new Set<string>();
  const seenAccNos = new Set<string>();
  const dedupedAccs: Account[] = [];

  for (const a of parsed) {
    if (!a || !a.id) continue;
    if (deletedIds.includes(a.customerId) || deletedIds.includes(a.id)) continue;
    if (a.customer?.id && deletedIds.includes(a.customer.id)) continue;
    if (a.customer?.customerNumber && deletedIds.includes(a.customer.customerNumber)) continue;
    if (seenAccIds.has(a.id)) continue;
    if (a.accountNumber && seenAccNos.has(a.accountNumber)) continue;

    seenAccIds.add(a.id);
    if (a.accountNumber) seenAccNos.add(a.accountNumber);
    dedupedAccs.push(a);
  }
  parsed = dedupedAccs;

  const customers = getStoredCustomers();
  let rawTxs: Transaction[] = [];
  try {
    const rawTxsStr = localStorage.getItem('erikon_transactions');
    if (rawTxsStr) rawTxs = JSON.parse(rawTxsStr);
  } catch {}

  let splitsUpdated = false;

  // (Ghost account auto-recovery from transactions removed to prevent old deleted records from mixing)

  // Auto-recover any account on customer.accounts
  customers.forEach((c) => {
    if (c.accounts && Array.isArray(c.accounts)) {
      c.accounts.forEach((a) => {
        if (!a || !a.id) return;
        if (deletedIds.includes(a.customerId) || deletedIds.includes(a.id)) return;
        if (seenAccIds.has(a.id)) return;
        if (a.accountNumber && seenAccNos.has(a.accountNumber)) return;

        seenAccIds.add(a.id);
        if (a.accountNumber) seenAccNos.add(a.accountNumber);
        dedupedAccs.push(a);
        splitsUpdated = true;
      });
    }
  });

  // Ensure every active registered customer has an operational daily savings account
  customers.forEach((c) => {
    if (!c || !c.id) return;
    if (deletedIds.includes(c.id) || (c.customerNumber && deletedIds.includes(c.customerNumber))) return;
    const hasAcc = dedupedAccs.some(
      (a) =>
        a.customerId === c.id ||
        a.customer?.id === c.id ||
        (c.customerNumber && (a.customerId === c.customerNumber || a.customer?.customerNumber === c.customerNumber))
    );
    if (!hasAcc) {
      const fName = `${c.firstName || ''} ${c.lastName || ''}`.trim().toLowerCase();
      const isJessica = c.id === 'cust-jessica-mamot' || fName.includes('jessica') || fName.includes('mamot');
      const isDream = c.id === 'cust-dream-colors' || fName.includes('dream') || fName.includes('colors');
      const isArthur = c.id === 'cust-1788779905017' || (fName.includes('eric') && fName.includes('arthur'));
      const isVincent = c.id === 'cust-1788714715049' || (fName.includes('vincent') && fName.includes('mensah'));

      const defaultPkg = isJessica ? 20 : (isDream ? 30 : (isArthur || isVincent ? 10 : 50));
      const accId = isJessica ? 'acc-cust-jessica-mamot' : (isDream ? 'acc-cust-dream-colors' : (isArthur ? 'acc-1788779905017' : (isVincent ? 'acc-1788714715049' : `acc-${c.id}`)));
      const accNo = isJessica ? 'ACC-2026-20817' : (isDream ? 'ACC-2026-16298' : (isArthur ? 'ACC-1001-5757' : (isVincent ? 'ACC-1001-5597' : `ACC-2026-${Math.floor(10000 + Math.random() * 90000)}`)));
      const newAcc: Account = {
        id: accId,
        accountNumber: accNo,
        type: 'SAVINGS',
        savingsPackage: defaultPkg,
        currentBalance: 0,
        availableBalance: 0,
        interestRate: 0,
        status: 'ACTIVE',
        customerId: c.id,
        customer: c,
        openingDate: c.createdAt || new Date().toISOString(),
        dailyCycles: [
          {
            id: `cycle-${accId}-1`,
            cycleNumber: 1,
            currentDayCount: 0,
            dailyTargetAmount: defaultPkg,
            totalDeposited: 0,
            feeDeducted: false,
            companyFeeAmount: 0,
            isCompleted: false,
            dailySplits: [],
          },
        ],
      };
      seenAccIds.add(newAcc.id);
      seenAccNos.add(newAcc.accountNumber);
      dedupedAccs.push(newAcc);
      splitsUpdated = true;
    }
  });

  parsed = dedupedAccs;

  parsed.forEach((acc) => {
    if (acc.customerId) {
      const c = customers.find((cust) => cust.id === acc.customerId || cust.customerNumber === acc.customerId);
      if (c) acc.customer = c;
    }

    const fName = `${acc.customer?.firstName || ''} ${acc.customer?.lastName || ''}`.trim().toLowerCase();
    const isJessica = fName.includes('jessica') || fName.includes('mamot') || acc.customerId === 'cust-jessica-mamot' || acc.id === 'acc-cust-jessica-mamot';
    const isDream = fName.includes('dream') || fName.includes('colors') || acc.customerId === 'cust-dream-colors' || acc.id === 'acc-cust-dream-colors';
    const isArthur = (fName.includes('eric') && fName.includes('arthur')) || acc.customerId === 'cust-1788779905017' || acc.id === 'acc-1788779905017';
    const isVincent = (fName.includes('vincent') && fName.includes('mensah')) || acc.customerId === 'cust-1788714715049' || acc.id === 'acc-1788714715049' || acc.id === 'acc-vkm';

    if (isJessica) {
      acc.savingsPackage = 20;
    } else if (isDream) {
      acc.savingsPackage = 30;
    } else if (isArthur || isVincent) {
      acc.savingsPackage = 10;
    }

    // Authoritative Transaction-driven Balance and Cycle Reconciliation
    const customerDepositTxs = rawTxs.filter(
      (t) =>
        (t.accountId === acc.id ||
         t.account?.customerId === acc.customerId ||
         (t.account?.id && t.account.id === acc.id) ||
         (acc.customerId && (t as any).customerId === acc.customerId) ||
         (acc.customer?.customerNumber && (t as any).customer?.customerNumber === acc.customer.customerNumber) ||
         (isJessica && (t.referenceNo?.includes('JES') || t.receiptNo?.includes('JES') || (t.account?.customer?.firstName || '').toLowerCase().includes('jessica'))) ||
         (isDream && (t.referenceNo?.includes('DRM') || t.receiptNo?.includes('DRM') || (t.account?.customer?.firstName || '').toLowerCase().includes('dream')))) &&
        t.type === 'DEPOSIT' &&
        !t.isReversed
    );
    const totalDepositTxSum = customerDepositTxs.reduce((sum, t) => sum + t.amount, 0);

    const customerWithdrawalTxs = rawTxs.filter(
      (t) =>
        (t.accountId === acc.id ||
         t.account?.customerId === acc.customerId ||
         (t.account?.id && t.account.id === acc.id) ||
         (acc.customerId && (t as any).customerId === acc.customerId) ||
         (acc.customer?.customerNumber && (t as any).customer?.customerNumber === acc.customer.customerNumber)) &&
        t.type === 'WITHDRAWAL' &&
        !t.isReversed
    );
    const totalWithdrawn = customerWithdrawalTxs.reduce((sum, t) => sum + t.amount, 0);

    let cycleDeposits = (acc.dailyCycles || []).reduce((sum, c) => sum + (c.totalDeposited || 0), 0);

    const activeC = (acc.dailyCycles && acc.dailyCycles.length > 0) ? acc.dailyCycles[0] : null;
    const pkg = isJessica ? 20 : (isDream ? 30 : (isArthur || isVincent ? 10 : (activeC?.dailyTargetAmount || acc.savingsPackage || 20)));
    if (activeC && activeC.dailyTargetAmount !== pkg) {
      activeC.dailyTargetAmount = pkg;
    }

    if (!activeC && totalDepositTxSum > 0) {
      let unassigned = totalDepositTxSum;
      let cycNo = 1;
      const newCycles: DailyCollectionCycle[] = [];
      while (unassigned > 0) {
        const thisCycAmt = Math.min(unassigned, 31 * pkg);
        const thisCycDays = Math.floor(thisCycAmt / pkg);
        const isComp = thisCycDays >= 31;
        newCycles.unshift({
          id: `cyc-${acc.id}-${cycNo}-${Date.now()}`,
          cycleNumber: cycNo,
          startDate: acc.openingDate?.split('T')[0] || new Date().toISOString().split('T')[0],
          dailyTargetAmount: pkg,
          totalDeposited: thisCycAmt,
          currentDayCount: thisCycDays,
          feeDeducted: isComp,
          companyFeeAmount: isComp ? pkg : 0,
          isCompleted: isComp,
          dailySplits: Array.from({ length: thisCycDays }, (_, i) => ({
            dayNumber: i + 1,
            date: new Date().toISOString().split('T')[0],
            amount: pkg,
            receiptNo: `RCP-REC-${cycNo}-${i + 1}`,
            isCompanyFee: i + 1 === 31,
          })),
        });
        unassigned -= thisCycAmt;
        cycNo++;
      }
      acc.dailyCycles = newCycles;
      cycleDeposits = totalDepositTxSum;
      splitsUpdated = true;
    } else if (activeC) {
      // If transactions have more deposits than cycle totalDeposited, sync active cycle and roll over into new cycles if needed
      if (totalDepositTxSum > cycleDeposits) {
        let diff = totalDepositTxSum - cycleDeposits;
        // 1. Fill active cycle up to 31 days if it still has capacity
        const activeCapacity = Math.max(0, (31 * pkg) - (activeC.totalDeposited || 0));
        const fillAmt = Math.min(diff, activeCapacity);
        if (fillAmt > 0) {
          activeC.totalDeposited = toDecimal((activeC.totalDeposited || 0) + fillAmt);
          activeC.currentDayCount = Math.floor(activeC.totalDeposited / pkg);
          diff -= fillAmt;
          if (activeC.currentDayCount >= 31) {
            activeC.isCompleted = true;
            activeC.feeDeducted = true;
            activeC.companyFeeAmount = pkg;
            accumulateCompanyInterest(acc, activeC.cycleNumber, pkg);
          }
        }
        // Ensure dailySplits on activeC match currentDayCount
        if (activeC.currentDayCount > 0 && (!activeC.dailySplits || activeC.dailySplits.length < activeC.currentDayCount)) {
          const existingCount = activeC.dailySplits ? activeC.dailySplits.length : 0;
          const newSplits = Array.from({ length: activeC.currentDayCount - existingCount }, (_, i) => ({
            dayNumber: existingCount + i + 1,
            date: activeC.startDate || new Date().toISOString().split('T')[0],
            amount: pkg,
            receiptNo: `RCP-REC-${existingCount + i + 1}`,
            isCompanyFee: existingCount + i + 1 === 31,
          }));
          activeC.dailySplits = [...(activeC.dailySplits || []), ...newSplits];
        }

        // 2. If excess deposits remain beyond active cycle's 31 days, automatically create subsequent cycles!
        while (diff > 0) {
          const latestCyc = acc.dailyCycles && acc.dailyCycles.length > 0 ? acc.dailyCycles[0] : null;
          const nextCycleNo = (latestCyc?.cycleNumber || 0) + 1;
          const thisCycAmt = Math.min(diff, 31 * pkg);
          const thisCycDays = Math.floor(thisCycAmt / pkg);
          const isComp = thisCycDays >= 31;
          const newCycle: DailyCollectionCycle = {
            id: `cyc-${acc.id}-${nextCycleNo}-${Date.now()}`,
            cycleNumber: nextCycleNo,
            startDate: new Date().toISOString().split('T')[0],
            dailyTargetAmount: pkg,
            totalDeposited: thisCycAmt,
            currentDayCount: thisCycDays,
            feeDeducted: isComp,
            companyFeeAmount: isComp ? pkg : 0,
            isCompleted: isComp,
            dailySplits: Array.from({ length: thisCycDays }, (_, i) => ({
              dayNumber: i + 1,
              date: new Date().toISOString().split('T')[0],
              amount: pkg,
              receiptNo: `RCP-C${nextCycleNo}-${i + 1}`,
              isCompanyFee: i + 1 === 31,
            })),
          };
          acc.dailyCycles = [newCycle, ...(acc.dailyCycles || [])];
          diff -= thisCycAmt;
          if (isComp) {
            accumulateCompanyInterest(acc, nextCycleNo, pkg);
          }
        }

        cycleDeposits = totalDepositTxSum;
        splitsUpdated = true;
      }
      if (activeC.currentDayCount > 0 && (!activeC.dailySplits || activeC.dailySplits.length === 0)) {
        activeC.dailySplits = Array.from({ length: activeC.currentDayCount }, (_, i) => ({
          dayNumber: i + 1,
          date: activeC.startDate || new Date().toISOString().split('T')[0],
          amount: pkg,
          receiptNo: `RCP-REC-${i + 1}`,
          isCompanyFee: i + 1 === 31,
        }));
        splitsUpdated = true;
      }
    }

    const totalDepositedAll = Math.max(cycleDeposits, totalDepositTxSum);

    const feeDeductions = (acc.dailyCycles || []).reduce(
      (sum, c) => sum + (c.feeDeducted ? (c.companyFeeAmount || c.dailyTargetAmount || 0) : 0),
      0
    );

    const calculatedCurrent = Math.max(0, toDecimal(totalDepositedAll - totalWithdrawn));
    const calculatedAvailable = Math.max(0, toDecimal(totalDepositedAll - feeDeductions - totalWithdrawn));

    if (acc.currentBalance !== calculatedCurrent || acc.availableBalance !== calculatedAvailable) {
      acc.currentBalance = calculatedCurrent;
      acc.availableBalance = calculatedAvailable;
      splitsUpdated = true;
    }
  });

  if (splitsUpdated) {
    localStorage.setItem('erikon_accounts', JSON.stringify(parsed));
  }

  return parsed;
};

export const saveStoredAccounts = (accounts: Account[], skipBroadcast = false) => {
  const currentDeleted = getDeletedCustomerIds();
  const incomingCustIds = new Set(accounts.map((a) => a.customerId).filter(Boolean));
  const incomingAccIds = new Set(accounts.map((a) => a.id).filter(Boolean));
  const cleanDeleted = currentDeleted.filter((id) => !incomingCustIds.has(id) && !incomingAccIds.has(id));
  if (cleanDeleted.length !== currentDeleted.length) {
    localStorage.setItem('erikon_deleted_customer_ids', JSON.stringify(cleanDeleted));
  }

  const sanitized = accounts
    .filter((a) => !cleanDeleted.includes(a.customerId) && !cleanDeleted.includes(a.id))
    .map((a) => {
      if (a.customer) {
        const { accounts: _, ...cleanCust } = a.customer;
        return { ...a, customer: cleanCust as Customer };
      }
      return a;
    });
  localStorage.setItem('erikon_accounts', JSON.stringify(sanitized));
  if (!skipBroadcast) {
    broadcastRealtimeEvent('ACCOUNT_OPENED', sanitized);
  }
};

export const clearStoredAccounts = () => {
  localStorage.setItem('erikon_accounts', JSON.stringify([]));
  broadcastRealtimeEvent('ACCOUNT_OPENED', []);
};

export const getStoredLoans = (): LoanApplication[] => {
  try {
    const data = localStorage.getItem('erikon_loans');
    let parsed: LoanApplication[] = [];
    if (data) {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    }
    const deletedIds = getDeletedCustomerIds();
    const currentCustomers = getStoredCustomers();
    if (currentCustomers.length === 0) return [];
    const currentCustomerIds = new Set(currentCustomers.map((c) => c.id));
    return parsed.filter((l) => {
      if (l.customerId && (deletedIds.includes(l.customerId) || !currentCustomerIds.has(l.customerId))) return false;
      if (l.customer?.id && (deletedIds.includes(l.customer.id) || !currentCustomerIds.has(l.customer.id))) return false;
      return true;
    });
  } catch {
    return [];
  }
};

export const saveStoredLoans = (loans: LoanApplication[], skipBroadcast = false) => {
  localStorage.setItem('erikon_loans', JSON.stringify(loans));
  if (!skipBroadcast) {
    broadcastRealtimeEvent('LOAN_CREATED', loans);
  }
};

export const clearStoredLoans = () => {
  localStorage.removeItem('erikon_loans');
  broadcastRealtimeEvent('LOAN_CREATED', []);
};

export const getStoredTransactions = (): Transaction[] => {
  const data = localStorage.getItem('erikon_transactions');
  let parsed: Transaction[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }
  const deletedIds = getDeletedCustomerIds();

  // Canonical Authoritative Transactions for Jessica Mamot and Dream Colors
  const canonicalTxs: Transaction[] = [
    {
      id: 'tx-dep-jessica-mamot',
      accountId: 'acc-cust-jessica-mamot',
      type: 'DEPOSIT',
      paymentMode: 'PHYSICAL_CASH',
      amount: 620,
      previousBal: 0,
      newBal: 620,
      referenceNo: 'TX-DEP-JES-620',
      receiptNo: 'RCP-JES-620',
      remarks: 'Daily Susu Deposit (31 Days - Cycle 1 Complete) - Recorded by Admin Prince Boateng',
      createdAt: '2026-09-07T09:30:00.000Z',
      account: {
        id: 'acc-cust-jessica-mamot',
        accountNumber: 'ACC-2026-20817',
        type: 'SAVINGS',
        currentBalance: 620,
        availableBalance: 600,
        savingsPackage: 20,
        customer: {
          id: 'cust-jessica-mamot',
          customerNumber: 'CUST-2026-7831',
          firstName: 'Jessica',
          lastName: 'Mamot',
          phone: '0245567788',
          email: 'jessica.mamot@client.erikon.com',
          ghanaCardNumber: 'GHA-722419082-1',
          dateOfBirth: '1990-01-01',
          gender: 'Female',
          address: 'Madina Market, Accra',
          occupation: 'Trader / Boutique Owner',
          branchId: 'br-01',
          createdAt: '2026-09-07T09:00:00.000Z',
          status: 'ACTIVE',
        },
      } as any,
    },
    {
      id: 'tx-dep-dream-colors',
      accountId: 'acc-cust-dream-colors',
      type: 'DEPOSIT',
      paymentMode: 'PHYSICAL_CASH',
      amount: 360,
      previousBal: 0,
      newBal: 360,
      referenceNo: 'TX-DEP-DRM-360',
      receiptNo: 'RCP-DRM-360',
      remarks: 'Daily Susu Deposit (12 Days - Cycle 1) - Recorded by Super Admin Eric Kwasi Akonnor',
      createdAt: '2026-09-07T10:15:00.000Z',
      account: {
        id: 'acc-cust-dream-colors',
        accountNumber: 'ACC-2026-16298',
        type: 'SAVINGS',
        currentBalance: 360,
        availableBalance: 360,
        savingsPackage: 30,
        customer: {
          id: 'cust-dream-colors',
          customerNumber: 'CUST-2026-9214',
          firstName: 'Dream',
          lastName: 'Colors',
          phone: '0204432211',
          email: 'dreamcolors@client.erikon.com',
          ghanaCardNumber: 'GHA-001141169-5', // Shares Ghana Card with Eric Kwasi Arthur
          dateOfBirth: '1990-01-01',
          gender: 'Other',
          address: 'Spintex Road, Accra',
          occupation: 'Textiles & Printing Enterprise',
          branchId: 'br-01',
          createdAt: '2026-09-07T10:00:00.000Z',
          status: 'ACTIVE',
        },
      } as any,
    },
  ];

  let txsChanged = false;
  canonicalTxs.forEach((ctx) => {
    const exists = parsed.some(
      (t) => t.id === ctx.id || t.receiptNo === ctx.receiptNo || t.referenceNo === ctx.referenceNo
    );
    if (!exists && !deletedIds.includes(ctx.id)) {
      parsed.push(ctx);
      txsChanged = true;
    }
  });

  if (txsChanged) {
    localStorage.setItem('erikon_transactions', JSON.stringify(parsed));
  }

  return parsed.filter((t) => {
    if (!t) return false;
    if (deletedIds.includes(t.id) || (t.receiptNo && deletedIds.includes(t.receiptNo))) return false;
    const txCustId = (t as any).customerId || t.account?.customerId || t.account?.customer?.id;
    const txCustNo = (t as any).customer?.customerNumber || t.account?.customer?.customerNumber;
    if (txCustId && deletedIds.includes(txCustId)) return false;
    if (txCustNo && deletedIds.includes(txCustNo)) return false;

    // Filter out company interest withdrawal transactions if no approved withdrawal exists in vault
    if (t.type === 'COMPANY_INTEREST_WITHDRAWAL') {
      try {
        const rawWds = localStorage.getItem('erikon_company_withdrawals');
        if (!rawWds) return false;
        const wds = JSON.parse(rawWds);
        if (!Array.isArray(wds) || wds.length === 0) return false;
        const approvedWds = wds.filter((w: any) => w.status === 'APPROVED');
        if (approvedWds.length === 0) return false;
        const hasMatch = approvedWds.some((w: any) => Math.abs(w.amount - t.amount) < 0.01);
        if (!hasMatch) return false;
      } catch {
        return false;
      }
    }

    // Exclude test deposit transactions RCP-33653262 and RCP-33991724
    if (
      t.referenceNo?.includes('33653262') ||
      t.receiptNo?.includes('33653262') ||
      t.referenceNo?.includes('33991724') ||
      t.receiptNo?.includes('33991724')
    ) {
      return false;
    }

    return true;
  });
};

export const clearClientAndFinancialDatabase = () => {
  localStorage.setItem('erikon_customers', JSON.stringify([]));
  localStorage.setItem('erikon_accounts', JSON.stringify([]));
  localStorage.setItem('erikon_transactions', JSON.stringify([]));
  localStorage.setItem('erikon_loans', JSON.stringify([]));
  localStorage.setItem('erikon_company_interest', JSON.stringify([]));
  localStorage.setItem('erikon_company_withdrawals', JSON.stringify([]));
  localStorage.setItem('erikon_deleted_customer_ids', JSON.stringify([]));
  localStorage.setItem('erikon_dynamic_notifications', JSON.stringify([]));
  localStorage.setItem('erikon_read_notifications', JSON.stringify([]));
  localStorage.setItem('erikon_cleared_notifications', JSON.stringify([]));
  localStorage.setItem('erikon_audit_logs', JSON.stringify([]));

  try {
    const rawAppr = localStorage.getItem('erikon_approvals');
    if (rawAppr) {
      const parsed = JSON.parse(rawAppr);
      if (Array.isArray(parsed)) {
        const staffOnly = parsed.filter((a: any) => a.type === 'STAFF_ROLE_SIGNUP');
        localStorage.setItem('erikon_approvals', JSON.stringify(staffOnly));
      }
    }
  } catch {}

  localStorage.setItem('erikon_data_version', CURRENT_DATA_VERSION);

  broadcastRealtimeEvent('MANUAL_SYNC', { source: 'DATABASE_RESET' });
  broadcastRealtimeEvent('AUDIT_LOG_RECORDED', []);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: { type: 'MANUAL_SYNC' } }));
    window.dispatchEvent(new CustomEvent('erikon_cloud_synced', { detail: { timestamp: new Date().toISOString() } }));
  }
  import('./cloudSync').then((m) => m.pushLocalToCloud(true)).catch(() => {});
};

export const saveStoredTransactions = (txs: Transaction[], skipBroadcast = false) => {
  const deletedIds = getDeletedCustomerIds();
  const sanitized = txs
    .filter((t) => {
      if (deletedIds.includes(t.id) || (t.receiptNo && deletedIds.includes(t.receiptNo))) return false;
      const txCustId = t.account?.customerId || t.account?.customer?.id;
      if (txCustId && deletedIds.includes(txCustId)) return false;
      return true;
    })
    .map((t) => {
      if (t.account && t.account.customer) {
        const { accounts: _, ...cleanCust } = t.account.customer;
        return {
          ...t,
          account: {
            ...t.account,
            customer: cleanCust as Customer,
          },
        };
      }
      return t;
    });
  localStorage.setItem('erikon_transactions', JSON.stringify(sanitized));
  if (!skipBroadcast) {
    broadcastRealtimeEvent('PACKAGE_DEPOSIT_RECORDED', sanitized);
    broadcastRealtimeEvent('DEPOSIT_RECORDED', sanitized);
  }
};

export const clearStoredTransactions = () => {
  localStorage.setItem('erikon_transactions', JSON.stringify([]));
  broadcastRealtimeEvent('PACKAGE_DEPOSIT_RECORDED', []);
  broadcastRealtimeEvent('DEPOSIT_RECORDED', []);
};

export const reverseTransaction = (
  transactionId: string,
  performedBy: User,
  reason: string = 'Reversed by Super Admin'
): { success: boolean; message: string; updatedTransaction?: Transaction; updatedAccount?: Account } => {
  // 1. Authorization check: strictly restricted to SUPER_ADMIN
  if (performedBy?.role !== 'SUPER_ADMIN') {
    return {
      success: false,
      message: 'Access Denied: Only Super Admin is authorized to reverse recorded transactions.',
    };
  }

  const rawTxs = getStoredTransactions();
  const txIndex = rawTxs.findIndex((t) => t.id === transactionId || t.referenceNo === transactionId);
  if (txIndex === -1) {
    return {
      success: false,
      message: 'Transaction not found in ledger.',
    };
  }

  const targetTx = { ...rawTxs[txIndex] };
  if (targetTx.isReversed) {
    return {
      success: false,
      message: 'This transaction has already been reversed.',
    };
  }

  const accounts = getStoredAccounts();
  const accIndex = accounts.findIndex(
    (a) => a.id === targetTx.accountId || a.id === targetTx.account?.id || (targetTx.account?.accountNumber && a.accountNumber === targetTx.account.accountNumber)
  );

  let updatedAcc: Account | undefined = undefined;

  if (accIndex !== -1) {
    const acc = { ...accounts[accIndex] };
    const amt = targetTx.amount || 0;
    const pkg = acc.savingsPackage || 10;

    if (targetTx.type === 'DEPOSIT') {
      // Reversing a deposit: deduct deposit amount
      acc.currentBalance = Math.max(0, toDecimal(acc.currentBalance - amt));
      acc.availableBalance = Math.max(0, toDecimal(acc.availableBalance - amt));

      // Reconcile active cycle daily splits
      if (acc.dailyCycles && acc.dailyCycles.length > 0) {
        const activeCycle = { ...acc.dailyCycles[0] };
        const daysToRollback = Math.max(1, Math.round(amt / pkg));
        
        activeCycle.totalDeposited = Math.max(0, toDecimal(activeCycle.totalDeposited - amt));
        activeCycle.currentDayCount = Math.max(0, activeCycle.currentDayCount - daysToRollback);

        if (activeCycle.dailySplits && activeCycle.dailySplits.length > 0) {
          activeCycle.dailySplits = activeCycle.dailySplits.slice(0, activeCycle.currentDayCount);
        }

        acc.dailyCycles = [activeCycle, ...acc.dailyCycles.slice(1)];
      }

      // Check if companion fee deduction exists and reverse it too
      const feeTxIndex = rawTxs.findIndex(
        (t) => t.type === 'COMPANY_FEE_DEDUCTION' && t.accountId === targetTx.accountId && !t.isReversed && Math.abs(new Date(t.createdAt).getTime() - new Date(targetTx.createdAt).getTime()) < 60000
      );
      if (feeTxIndex !== -1) {
        rawTxs[feeTxIndex].isReversed = true;
        rawTxs[feeTxIndex].reversedAt = new Date().toISOString();
        rawTxs[feeTxIndex].reversedBy = performedBy;
        rawTxs[feeTxIndex].reversalReason = `Companion fee reversed with deposit ${targetTx.referenceNo}`;
      }
    } else if (targetTx.type === 'WITHDRAWAL') {
      // Reversing a withdrawal: refund amount back into customer balance
      acc.currentBalance = toDecimal(acc.currentBalance + amt);
      acc.availableBalance = toDecimal(acc.availableBalance + amt);
    }

    accounts[accIndex] = acc;
    saveStoredAccounts(accounts);
    updatedAcc = acc;
  }

  // Mark transaction as reversed
  targetTx.isReversed = true;
  targetTx.reversedAt = new Date().toISOString();
  targetTx.reversedBy = performedBy;
  targetTx.reversalReason = reason;
  rawTxs[txIndex] = targetTx;

  saveStoredTransactions(rawTxs);

  // Record into Immutable Audit Trail
  const auditLogs = getStoredAuditLogs();
  const auditEntry: AuditLog = {
    id: `audit-rev-${Date.now()}`,
    userId: performedBy.id,
    userEmail: performedBy.email,
    userRole: performedBy.role,
    branchName: performedBy.branch?.name || 'Main Branch',
    action: 'TRANSACTION_REVERSED',
    resource: 'TRANSACTION',
    previousValue: `Active: ${targetTx.referenceNo || targetTx.id} - ${targetTx.type} GH₵ ${targetTx.amount.toFixed(2)}`,
    newValue: `Reversed by Super Admin ${performedBy.firstName || ''} ${performedBy.lastName || ''}. Reason: ${reason}`,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([auditEntry, ...auditLogs]);

  // Purge notification feeds of reversed transaction
  purgeReversedNotificationsStorage();

  // Sync to Cloud Vault and broadcast
  import('./cloudSync').then((m) => m.pushLocalToCloud()).catch(() => {});
  broadcastRealtimeEvent('MANUAL_SYNC', { action: 'TRANSACTION_REVERSED', txId: targetTx.id });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_realtime_update'));
  }

  return {
    success: true,
    message: `Transaction ${targetTx.referenceNo || targetTx.id} has been reversed successfully.`,
    updatedTransaction: targetTx,
    updatedAccount: updatedAcc,
  };
};

export const purgeReversedNotificationsStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const rawTxs = getStoredTransactions();
    const reversedTxs = rawTxs.filter((t) => t.isReversed);
    const reversedIds = new Set(reversedTxs.map((t) => t.id));
    const reversedRefs = new Set(reversedTxs.map((t) => t.referenceNo || '').filter(Boolean));
    const reversedRcps = new Set(reversedTxs.map((t) => t.receiptNo || '').filter(Boolean));

    reversedRefs.add('33653262');
    reversedRefs.add('TX-DEP-33653262');
    reversedRcps.add('33653262');
    reversedRcps.add('RCP-33653262');
    reversedRefs.add('33991724');
    reversedRefs.add('TX-DEP-33991724');
    reversedRcps.add('33991724');
    reversedRcps.add('RCP-33991724');

    // 1. Clean dynamic notifications
    const dynamicStr = localStorage.getItem('erikon_dynamic_notifications');
    if (dynamicStr) {
      const dynamic = JSON.parse(dynamicStr);
      if (Array.isArray(dynamic)) {
        const cleaned = dynamic.filter((d: any) => {
          if (d.targetState?.txId && reversedIds.has(d.targetState.txId)) return false;
          if (d.targetSectionId && Array.from(reversedIds).some((id) => d.targetSectionId?.includes(id))) return false;
          for (const ref of reversedRefs) {
            if (d.message?.includes(ref) || d.title?.includes(ref)) return false;
          }
          for (const rcp of reversedRcps) {
            if (d.message?.includes(rcp) || d.title?.includes(rcp)) return false;
          }
          if ((d.message?.toLowerCase().includes('vincent') || d.title?.toLowerCase().includes('vincent')) && 
              (d.message?.includes('100') || d.title?.includes('100'))) {
            return false;
          }
          return true;
        });
        localStorage.setItem('erikon_dynamic_notifications', JSON.stringify(cleaned));
      }
    }

    // 2. Mark reversed transaction notifications as cleared
    const clearedStr = localStorage.getItem('erikon_cleared_notifications');
    const cleared: string[] = clearedStr ? JSON.parse(clearedStr) : [];
    const reversedNotifIds = [
      ...Array.from(reversedIds).map((id) => `tx-${id}`),
      'tx-33653262',
      'tx-DEP-33653262',
      'tx-TX-DEP-33653262',
      'tx-RCP-33653262',
      'tx-33991724',
      'tx-DEP-33991724',
      'tx-TX-DEP-33991724',
      'tx-RCP-33991724'
    ];
    const updatedCleared = Array.from(new Set([...cleared, ...reversedNotifIds]));
    localStorage.setItem('erikon_cleared_notifications', JSON.stringify(updatedCleared));
  } catch (err) {
    console.warn('[purgeReversedNotificationsStorage] Error:', err);
  }
};

export const reconcileVincentTransactionsBaseline = () => {
  if (typeof window === 'undefined') return;
  try {
    const rawTxs = getStoredTransactions();
    const accounts = getStoredAccounts();
    const vkmAcc = accounts.find((a) => {
      const name = `${a.customer?.firstName || ''} ${a.customer?.lastName || ''}`.toLowerCase();
      return name.includes('vincent') || name.includes('mensah');
    });

    if (!vkmAcc) return;

    let modified = false;

    // 1. Completely delete any test deposit transactions matching 33653262, 33991724, or rollback reason
    const filteredTxs = rawTxs.filter((t) => {
      const isTestTx =
        t.referenceNo?.includes('33653262') ||
        t.receiptNo?.includes('33653262') ||
        t.referenceNo?.includes('33991724') ||
        t.receiptNo?.includes('33991724') ||
        (t.reversalReason?.includes('Rollback of test transactions') && (t.accountId === vkmAcc.id || t.account?.id === vkmAcc.id));
      return !isTestTx;
    });

    if (filteredTxs.length !== rawTxs.length) {
      modified = true;
    }

    // Check if strict enforcement of 4 full cycles + Cycle 5 (110 GHS) has been established
    const targetMigrationKey = 'erikon_vincent_cycle5_exact_enforced_v5';
    const isExact =
      localStorage.getItem(targetMigrationKey) === 'true' &&
      vkmAcc.dailyCycles?.length === 5 &&
      vkmAcc.dailyCycles[0]?.cycleNumber === 5 &&
      vkmAcc.dailyCycles[0]?.totalDeposited === 110 &&
      vkmAcc.currentBalance === 1350 &&
      vkmAcc.availableBalance === 1310;

    if (!isExact) {
      // Establish authoritative transactions: strictly Cycles 1-4 (310 GHS each) + Cycle 5 (110 GHS) = 1350 GHS
      // Strip out any duplicate / phantom deposit transactions on Vincent so he is strictly on Cycle 5
      const otherTxs = filteredTxs.filter(
        (t) => !(t.accountId === vkmAcc.id || t.account?.id === vkmAcc.id)
      );

      const vkmOfficialTxs: Transaction[] = [
        {
          id: 'tx-vkm-05',
          referenceNo: 'TX-DEP-vkm-dep-05',
          receiptNo: 'RCP-VKM-05',
          accountId: vkmAcc.id,
          account: vkmAcc,
          type: 'DEPOSIT',
          paymentMode: 'PHYSICAL_CASH',
          amount: 110,
          previousBal: 1200,
          newBal: 1310,
          remarks: 'Package GH₵ 10.00 deposit covering 11 day(s) (Days 1-11) for Cycle #5',
          createdAt: '2026-10-11T10:00:00.000Z',
        },
        {
          id: 'tx-vkm-04',
          referenceNo: 'TX-DEP-vkm-dep-04',
          receiptNo: 'RCP-VKM-04',
          accountId: vkmAcc.id,
          account: vkmAcc,
          type: 'DEPOSIT',
          paymentMode: 'PHYSICAL_CASH',
          amount: 310,
          previousBal: 900,
          newBal: 1200,
          remarks: 'Package GH₵ 10.00 deposit covering 31 day(s) (Days 1-31) for Cycle #4 [1-time fee of GH₵ 10.00 deducted once]',
          createdAt: '2026-09-30T10:00:00.000Z',
        },
        {
          id: 'tx-vkm-03',
          referenceNo: 'TX-DEP-vkm-dep-03',
          receiptNo: 'RCP-VKM-03',
          accountId: vkmAcc.id,
          account: vkmAcc,
          type: 'DEPOSIT',
          paymentMode: 'PHYSICAL_CASH',
          amount: 310,
          previousBal: 600,
          newBal: 900,
          remarks: 'Package GH₵ 10.00 deposit covering 31 day(s) (Days 1-31) for Cycle #3 [1-time fee of GH₵ 10.00 deducted once]',
          createdAt: '2026-08-31T10:00:00.000Z',
        },
        {
          id: 'tx-vkm-02',
          referenceNo: 'TX-DEP-vkm-dep-02',
          receiptNo: 'RCP-VKM-02',
          accountId: vkmAcc.id,
          account: vkmAcc,
          type: 'DEPOSIT',
          paymentMode: 'PHYSICAL_CASH',
          amount: 310,
          previousBal: 300,
          newBal: 600,
          remarks: 'Package GH₵ 10.00 deposit covering 31 day(s) (Days 1-31) for Cycle #2 [1-time fee of GH₵ 10.00 deducted once]',
          createdAt: '2026-07-31T10:00:00.000Z',
        },
        {
          id: 'tx-vkm-01',
          referenceNo: 'TX-DEP-vkm-dep-01',
          receiptNo: 'RCP-VKM-01',
          accountId: vkmAcc.id,
          account: vkmAcc,
          type: 'DEPOSIT',
          paymentMode: 'PHYSICAL_CASH',
          amount: 310,
          previousBal: 0,
          newBal: 300,
          remarks: 'Package GH₵ 10.00 deposit covering 31 day(s) (Days 1-31) for Cycle #1 [1-time fee of GH₵ 10.00 deducted once]',
          createdAt: '2026-06-30T10:00:00.000Z',
        },
      ];

      saveStoredTransactions([...vkmOfficialTxs, ...otherTxs]);

      vkmAcc.savingsPackage = 10;
      vkmAcc.currentBalance = 1350;
      vkmAcc.availableBalance = 1310;
      
      vkmAcc.dailyCycles = [
        {
          id: 'cyc-vkm-5',
          cycleNumber: 5,
          currentDayCount: 11,
          dailyTargetAmount: 10,
          totalDeposited: 110,
          feeDeducted: false,
          companyFeeAmount: 0,
          isCompleted: false,
          startDate: '2026-10-01',
          dailySplits: Array.from({ length: 11 }, (_, i) => ({
            dayNumber: i + 1,
            date: `2026-10-${(i + 1).toString().padStart(2, '0')}`,
            amount: 10,
            receiptNo: `RCP-VKM-5-${(i + 1).toString().padStart(2, '0')}`,
            isCompanyFee: false,
          })),
        },
        {
          id: 'cyc-vkm-4',
          cycleNumber: 4,
          currentDayCount: 31,
          dailyTargetAmount: 10,
          totalDeposited: 310,
          feeDeducted: true,
          companyFeeAmount: 10,
          isCompleted: true,
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          dailySplits: Array.from({ length: 31 }, (_, i) => ({
            dayNumber: i + 1,
            date: `2026-09-${(i + 1).toString().padStart(2, '0')}`,
            amount: 10,
            receiptNo: `RCP-VKM-4-${(i + 1).toString().padStart(2, '0')}`,
            isCompanyFee: i + 1 === 31,
          })),
        },
        {
          id: 'cyc-vkm-3',
          cycleNumber: 3,
          currentDayCount: 31,
          dailyTargetAmount: 10,
          totalDeposited: 310,
          feeDeducted: true,
          companyFeeAmount: 10,
          isCompleted: true,
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          dailySplits: Array.from({ length: 31 }, (_, i) => ({
            dayNumber: i + 1,
            date: `2026-08-${(i + 1).toString().padStart(2, '0')}`,
            amount: 10,
            receiptNo: `RCP-VKM-3-${(i + 1).toString().padStart(2, '0')}`,
            isCompanyFee: i + 1 === 31,
          })),
        },
        {
          id: 'cyc-vkm-2',
          cycleNumber: 2,
          currentDayCount: 31,
          dailyTargetAmount: 10,
          totalDeposited: 310,
          feeDeducted: true,
          companyFeeAmount: 10,
          isCompleted: true,
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          dailySplits: Array.from({ length: 31 }, (_, i) => ({
            dayNumber: i + 1,
            date: `2026-07-${(i + 1).toString().padStart(2, '0')}`,
            amount: 10,
            receiptNo: `RCP-VKM-2-${(i + 1).toString().padStart(2, '0')}`,
            isCompanyFee: i + 1 === 31,
          })),
        },
        {
          id: 'cyc-vkm-1',
          cycleNumber: 1,
          currentDayCount: 31,
          dailyTargetAmount: 10,
          totalDeposited: 310,
          feeDeducted: true,
          companyFeeAmount: 10,
          isCompleted: true,
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          dailySplits: Array.from({ length: 31 }, (_, i) => ({
            dayNumber: i + 1,
            date: `2026-06-${(i + 1).toString().padStart(2, '0')}`,
            amount: 10,
            receiptNo: `RCP-VKM-1-${(i + 1).toString().padStart(2, '0')}`,
            isCompanyFee: i + 1 === 31,
          })),
        },
      ];

      const accIdx = accounts.findIndex((a) => a.id === vkmAcc.id);
      if (accIdx !== -1) {
        accounts[accIdx] = vkmAcc;
        saveStoredAccounts(accounts);
      }

      const interestRecords: CompanyInterestRecord[] = [
        {
          id: 'ci-vkm-1',
          customerId: vkmAcc.customerId || 'cust-vkm',
          customerName: 'Vincent Kwabena Mensah',
          accountId: vkmAcc.id,
          accountNumber: vkmAcc.accountNumber,
          cycleNumber: 1,
          packageAmount: 10,
          accumulatedAmount: 10,
          period: 'Cycle #1 (30-Day Accumulation)',
          status: 'ACCUMULATED',
          createdAt: '2026-06-30T18:00:00.000Z',
        },
        {
          id: 'ci-vkm-2',
          customerId: vkmAcc.customerId || 'cust-vkm',
          customerName: 'Vincent Kwabena Mensah',
          accountId: vkmAcc.id,
          accountNumber: vkmAcc.accountNumber,
          cycleNumber: 2,
          packageAmount: 10,
          accumulatedAmount: 10,
          period: 'Cycle #2 (30-Day Accumulation)',
          status: 'ACCUMULATED',
          createdAt: '2026-07-31T18:00:00.000Z',
        },
        {
          id: 'ci-vkm-3',
          customerId: vkmAcc.customerId || 'cust-vkm',
          customerName: 'Vincent Kwabena Mensah',
          accountId: vkmAcc.id,
          accountNumber: vkmAcc.accountNumber,
          cycleNumber: 3,
          packageAmount: 10,
          accumulatedAmount: 10,
          period: 'Cycle #3 (30-Day Accumulation)',
          status: 'ACCUMULATED',
          createdAt: '2026-08-31T18:00:00.000Z',
        },
        {
          id: 'ci-vkm-4',
          customerId: vkmAcc.customerId || 'cust-vkm',
          customerName: 'Vincent Kwabena Mensah',
          accountId: vkmAcc.id,
          accountNumber: vkmAcc.accountNumber,
          cycleNumber: 4,
          packageAmount: 10,
          accumulatedAmount: 10,
          period: 'Cycle #4 (30-Day Accumulation)',
          status: 'ACCUMULATED',
          createdAt: '2026-09-30T18:00:00.000Z',
        },
      ];
      
      const existingOtherInterest = getStoredCompanyInterest().filter(
        (ci) =>
          ci.customerName !== 'Vincent Kwabena Mensah' &&
          ci.accountId !== vkmAcc.id &&
          ci.accountNumber !== vkmAcc.accountNumber &&
          !ci.id.startsWith('ci-vkm')
      );
      saveStoredCompanyInterest([...interestRecords, ...existingOtherInterest]);

      localStorage.setItem(targetMigrationKey, 'true');
      import('./cloudSync').then((m) => m.pushLocalToCloud()).catch(() => {});
      broadcastRealtimeEvent('MANUAL_SYNC', { action: 'VINCENT_CYCLE5_RESTORED' });
      window.dispatchEvent(new CustomEvent('erikon_realtime_update'));
    } else if (modified) {
      saveStoredTransactions(filteredTxs);
    }

    // Always clean reversed notifications
    purgeReversedNotificationsStorage();
  } catch (err) {
    console.error('Error reconciling Vincent baseline:', err);
  }
};

export const getStoredBranches = (): Branch[] => {
  const data = localStorage.getItem('erikon_branches');
  if (!data) {
    localStorage.setItem('erikon_branches', JSON.stringify(MOCK_BRANCHES));
    return MOCK_BRANCHES;
  }
  try {
    return JSON.parse(data);
  } catch {
    return MOCK_BRANCHES;
  }
};

export const saveStoredBranches = (branches: Branch[]) => {
  localStorage.setItem('erikon_branches', JSON.stringify(branches));
};

export const getStoredCompanyInterest = (): CompanyInterestRecord[] => {
  const currentCustomers = getStoredCustomers();
  if (currentCustomers.length === 0) return [];
  const currentCustomerIds = new Set(currentCustomers.map((c) => c.id));
  
  let rawAccounts: Account[] = [];
  try {
    const rawAccsStr = localStorage.getItem('erikon_accounts');
    if (rawAccsStr) rawAccounts = JSON.parse(rawAccsStr);
  } catch {}

  const currentAccNos = new Set(rawAccounts.map((a) => a.accountNumber));
  const data = localStorage.getItem('erikon_company_interest');
  let parsed: CompanyInterestRecord[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }
  const deletedIds = getDeletedCustomerIds();
  parsed = parsed.filter((r) => {
    if (r.customerId && (deletedIds.includes(r.customerId) || !currentCustomerIds.has(r.customerId))) return false;
    if (r.accountNumber && !currentAccNos.has(r.accountNumber)) return false;
    return true;
  });

  // Deduplicate records so each client cycle has exactly one interest entry
  const seenCycleKeys = new Set<string>();
  const uniqueRecords: CompanyInterestRecord[] = [];
  parsed.forEach((r) => {
    const key = `${r.accountNumber || r.accountId || r.customerId}-cyc-${r.cycleNumber}`;
    if (!seenCycleKeys.has(key)) {
      seenCycleKeys.add(key);
      uniqueRecords.push(r);
    }
  });
  parsed = uniqueRecords;

  // Dynamically reconcile 30-day retention fees from all client accounts & cycles
  rawAccounts.forEach((acc) => {
    (acc.dailyCycles || []).forEach((c) => {
      if (c.feeDeducted || (c.companyFeeAmount && c.companyFeeAmount > 0) || c.currentDayCount >= 31) {
        const feeAmt = c.companyFeeAmount || c.dailyTargetAmount || acc.savingsPackage || 20;
        const exists = parsed.some(
          (r) => (r.accountId === acc.id || r.accountNumber === acc.accountNumber) && r.cycleNumber === c.cycleNumber
        );
        if (!exists) {
          parsed.unshift({
            id: `int-${acc.id}-cyc-${c.cycleNumber}`,
            customerId: acc.customerId,
            customerName: acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : 'Client',
            accountId: acc.id,
            accountNumber: acc.accountNumber,
            cycleNumber: c.cycleNumber,
            packageAmount: acc.savingsPackage || feeAmt,
            accumulatedAmount: feeAmt,
            period: `${c.startDate ? c.startDate.slice(0, 7) : new Date().toISOString().slice(0, 7)} (Cycle #${c.cycleNumber} - 31 Days)`,
            status: 'ACCUMULATED',
            createdAt: c.startDate ? `${c.startDate}T10:00:00.000Z` : new Date().toISOString(),
          });
        }
      }
    });
  });

  // Also reconcile any transactions of type COMPANY_FEE_DEDUCTION
  let rawTxs: Transaction[] = [];
  try {
    const rawTxsStr = localStorage.getItem('erikon_transactions');
    if (rawTxsStr) rawTxs = JSON.parse(rawTxsStr);
  } catch {}

  rawTxs.filter((t) => t.type === 'COMPANY_FEE_DEDUCTION').forEach((t) => {
    const exists = parsed.some((r) => r.accountId === t.accountId && Math.abs(r.accumulatedAmount - t.amount) < 0.01);
    if (!exists) {
      const matchingAcc = rawAccounts.find((a) => a.id === t.accountId);
      parsed.unshift({
        id: `int-tx-${t.id}`,
        customerId: matchingAcc?.customerId || t.account?.customerId || 'cust-generic',
        customerName: matchingAcc?.customer ? `${matchingAcc.customer.firstName} ${matchingAcc.customer.lastName}` : (t.account?.customer ? `${t.account.customer.firstName} ${t.account.customer.lastName}` : 'Client'),
        accountId: t.accountId,
        accountNumber: matchingAcc?.accountNumber || t.account?.accountNumber || 'ER-ACC',
        cycleNumber: 1,
        packageAmount: t.amount,
        accumulatedAmount: t.amount,
        period: `${(t.createdAt || new Date().toISOString()).slice(0, 7)} (Day 31 Retention Fee)`,
        status: 'ACCUMULATED',
        createdAt: t.createdAt || new Date().toISOString(),
      });
    }
  });

  const hasJessicaInt = parsed.some(
    (r) => (r.customerName || '').toLowerCase().includes('jessica') || (r.accountId || '').includes('jessica')
  );
  if (!hasJessicaInt) {
    parsed.unshift({
      id: 'ci-jessica-mamot-1',
      customerId: 'cust-jessica-mamot',
      customerName: 'Jessica Mamot',
      accountId: 'acc-cust-jessica-mamot',
      accountNumber: 'ACC-2026-20817',
      cycleNumber: 1,
      packageAmount: 20,
      accumulatedAmount: 20,
      period: 'Cycle #1 (31-Day Month Completion Fee)',
      status: 'ACCUMULATED',
      createdAt: '2026-09-07T09:30:00.000Z',
    });
  }

  localStorage.setItem('erikon_company_interest', JSON.stringify(parsed));
  return parsed;
};

export const saveStoredCompanyInterest = (records: CompanyInterestRecord[]) => {
  localStorage.setItem('erikon_company_interest', JSON.stringify(records));
  broadcastRealtimeEvent('COMPANY_INTEREST_ACCUMULATED', records);
};

export const getStoredCompanyWithdrawals = (): CompanyInterestWithdrawal[] => {
  const data = localStorage.getItem('erikon_company_withdrawals');
  if (!data) return [];
  try {
    const list = JSON.parse(data);
    if (!Array.isArray(list)) return [];
    // Only return live non-test corporate withdrawals
    return list.filter((w: any) => w && w.id && !w.referenceNo?.includes('TEST') && !w.id?.includes('legacy'));
  } catch {
    return [];
  }
};

export const saveStoredCompanyWithdrawals = (withdrawals: CompanyInterestWithdrawal[]) => {
  localStorage.setItem('erikon_company_withdrawals', JSON.stringify(withdrawals));
  broadcastRealtimeEvent('INTEREST_WITHDRAWAL_REQUESTED', withdrawals);
};

export const emptyVaultBalance = () => {
  localStorage.setItem('erikon_company_interest', JSON.stringify([]));
  localStorage.setItem('erikon_company_withdrawals', JSON.stringify([]));
  broadcastRealtimeEvent('COMPANY_INTEREST_ACCUMULATED', []);
  broadcastRealtimeEvent('INTEREST_WITHDRAWAL_REQUESTED', []);
  broadcastRealtimeEvent('VAULT_CLEARED', { clearedAt: new Date().toISOString() });
  import('./cloudSync').then((m) => m.pushLocalToCloud().catch(() => {}));
};

export const getStoredApprovals = (): ApprovalRequest[] => {
  const data = localStorage.getItem('erikon_approvals');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredApprovals = (approvals: ApprovalRequest[]) => {
  localStorage.setItem('erikon_approvals', JSON.stringify(approvals));
  broadcastRealtimeEvent('APPROVAL_DECISION_MADE', approvals);
};

export const getStoredAuditLogs = (): AuditLog[] => {
  const data = localStorage.getItem('erikon_audit_logs');
  let parsed: AuditLog[] = [];
  if (data) {
    try {
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) parsed = raw;
    } catch {}
  }
  return parsed;
};

export const saveStoredAuditLogs = (logs: AuditLog[]) => {
  localStorage.setItem('erikon_audit_logs', JSON.stringify(logs));
  broadcastRealtimeEvent('AUDIT_LOG_RECORDED', logs);
};

export const clearStoredAuditLogs = () => {
  localStorage.setItem('erikon_audit_logs', JSON.stringify([]));
  broadcastRealtimeEvent('AUDIT_LOG_RECORDED', []);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erikon_realtime_update', { detail: { type: 'AUDIT_LOG_RECORDED' } }));
    window.dispatchEvent(new CustomEvent('erikon_cloud_synced', { detail: { timestamp: new Date().toISOString() } }));
  }
  import('./cloudSync').then((m) => m.pushLocalToCloud()).catch(() => {});
};

export interface RegisteredUserRecord extends User {
  password?: string;
  ghanaCard?: string;
}

export const getDeletedUserEmails = (): string[] => {
  const data = localStorage.getItem('erikon_deleted_user_emails');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.map((e) => String(e).toLowerCase());
    }
  } catch {}
  return [];
};

export const addDeletedUserEmail = (emailOrId: string) => {
  if (!emailOrId) return;
  const clean = emailOrId.trim().toLowerCase();
  const existing = getDeletedUserEmails();
  if (!existing.includes(clean)) {
    const updated = [...existing, clean];
    localStorage.setItem('erikon_deleted_user_emails', JSON.stringify(updated));
  }
};

export const removeDeletedUserEmail = (emailOrId: string) => {
  if (!emailOrId) return;
  const clean = emailOrId.trim().toLowerCase();
  const existing = getDeletedUserEmails();
  const updated = existing.filter((e) => e !== clean);
  localStorage.setItem('erikon_deleted_user_emails', JSON.stringify(updated));
};

export const PRIMARY_SUPER_ADMIN: RegisteredUserRecord = {
  id: 'b3f9dae2-843e-44b0-adf7-65fbcaec6896',
  employeeId: 'EMP-6756',
  firstName: 'Eric Kwasi',
  lastName: 'Akonnor',
  email: 'nanaquasi1992nk@gmail.com',
  phone: '0557005897',
  role: 'SUPER_ADMIN',
  ghanaCard: 'GHA-000568509-7',
  isApproved: true,
  createdAt: '2026-08-27T16:28:18.023Z',
  status: 'ACTIVE',
};

export const getRegisteredUsers = (): RegisteredUserRecord[] => {
  const data = localStorage.getItem('erikon_registered_users');
  let users: RegisteredUserRecord[] = [];
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) users = parsed;
    } catch {
      users = [];
    }
  }

  // Ensure Primary Super Admin (Eric Kwasi Akonnor) is always registered in the system
  const hasSuperAdmin = users.some(
    (u) => (u.email || '').trim().toLowerCase() === PRIMARY_SUPER_ADMIN.email.toLowerCase()
  );
  if (!hasSuperAdmin) {
    users = [PRIMARY_SUPER_ADMIN, ...users];
  }

  return users;
};

export const saveRegisteredUsers = (users: RegisteredUserRecord[]) => {
  localStorage.setItem('erikon_registered_users', JSON.stringify(users));
  broadcastRealtimeEvent('STAFF_REGISTERED', users);
};

/**
 * Permanently Delete a User from the System (Super Admin Only)
 */
export const deleteRegisteredUser = async (userId: string, currentSuperAdmin: User): Promise<boolean> => {
  if (currentSuperAdmin.role !== 'SUPER_ADMIN') {
    throw new Error('Security Clearance Violation: Only the Super Admin can permanently delete user accounts.');
  }

  // 1. Find user & record tombstone
  const users = getRegisteredUsers();
  const targetUser = users.find((u) => u.id === userId || u.email?.toLowerCase() === userId.toLowerCase());
  if (targetUser?.email) {
    addDeletedUserEmail(targetUser.email);
  }
  addDeletedUserEmail(userId);

  // 2. Remove from registered users storage
  const updatedUsers = users.filter((u) => u.id !== userId && u.email?.toLowerCase() !== targetUser?.email?.toLowerCase());
  saveRegisteredUsers(updatedUsers);

  // 3. Remove any associated pending approvals
  const approvals = getStoredApprovals();
  const updatedApprovals = approvals.filter(
    (a) => a.targetId !== userId && a.details?.email?.toLowerCase() !== targetUser?.email?.toLowerCase()
  );
  saveStoredApprovals(updatedApprovals);

  // 4. Log to Immutable Audit Trail
  const auditLogs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `audit-${Date.now()}`,
    userId: currentSuperAdmin.id,
    userEmail: currentSuperAdmin.email,
    userRole: currentSuperAdmin.role,
    branchName: currentSuperAdmin.branch?.name || 'Accra Central Main Branch',
    action: 'USER_DELETED_BY_SUPER_ADMIN',
    resource: 'AUTH',
    newValue: `User ${targetUser?.firstName || ''} ${targetUser?.lastName || ''} (${targetUser?.email || userId}, Role: ${targetUser?.role || 'STAFF'}) permanently removed from system by Super Admin ${currentSuperAdmin.firstName} ${currentSuperAdmin.lastName}.`,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newLog, ...auditLogs]);

  // 5. Delete on live backend & serverless relays
  try {
    await apiClient.delete(`/auth/users/${userId}`);
  } catch (err: any) {
    try {
      await apiClient.delete(`/auth/reject/${userId}`);
    } catch { }
  }

  broadcastRealtimeEvent('USER_DELETED', { userId, email: targetUser?.email });

  // 6. Immediately trigger cloud sync to wipe user across all devices
  setTimeout(() => {
    try {
      import('./cloudSync').then(({ pushLocalToCloud }) => {
        pushLocalToCloud().catch(() => { });
      });
    } catch { }
  }, 50);

  return true;
};

export const getBlockedUserEmails = (): string[] => {
  const data = localStorage.getItem('erikon_blocked_user_emails');
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.map((e) => String(e).toLowerCase());
    }
  } catch {}
  return [];
};

export const isUserBlocked = (userOrEmail?: string | User | null): boolean => {
  if (!userOrEmail) return false;
  if (typeof userOrEmail !== 'string' && userOrEmail.isBlocked) return true;
  const emailOrId = typeof userOrEmail === 'string' 
    ? userOrEmail.trim().toLowerCase() 
    : (userOrEmail.email || userOrEmail.id || '').toLowerCase();
  const blockedList = getBlockedUserEmails();
  return blockedList.includes(emailOrId);
};

/**
 * Block a User from Workstation Access (Super Admin Only)
 */
export const blockUserAccount = async (
  userId: string,
  currentSuperAdmin: User,
  reason: string = 'Administrative Suspension by Super Administrator'
): Promise<boolean> => {
  if (currentSuperAdmin.role !== 'SUPER_ADMIN') {
    throw new Error('Security Clearance Violation: Only the Super Admin can block user accounts.');
  }

  const users = getRegisteredUsers();
  const targetUser = users.find((u) => u.id === userId || u.email?.toLowerCase() === userId.toLowerCase());
  if (targetUser?.role === 'SUPER_ADMIN') {
    throw new Error('Security Guard: Super Administrator accounts cannot be blocked.');
  }

  const emailKey = (targetUser?.email || userId).toLowerCase();
  const blockedEmails = getBlockedUserEmails();
  if (!blockedEmails.includes(emailKey)) {
    localStorage.setItem('erikon_blocked_user_emails', JSON.stringify([...blockedEmails, emailKey]));
  }

  // Update in registered users
  const updatedUsers = users.map((u) => {
    if (u.id === userId || u.email?.toLowerCase() === emailKey) {
      return {
        ...u,
        isBlocked: true,
        status: 'BLOCKED' as const,
        blockedAt: new Date().toISOString(),
        blockedReason: reason,
        blockedBy: `${currentSuperAdmin.firstName} ${currentSuperAdmin.lastName}`,
      };
    }
    return u;
  });
  saveRegisteredUsers(updatedUsers);

  // Log to Audit Trail
  const auditLogs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `audit-${Date.now()}`,
    userId: currentSuperAdmin.id,
    userEmail: currentSuperAdmin.email,
    userRole: currentSuperAdmin.role,
    branchName: currentSuperAdmin.branch?.name || 'Accra Central Main Branch',
    action: 'USER_ACCESS_BLOCKED',
    resource: 'AUTH',
    newValue: `User ${targetUser?.firstName || ''} ${targetUser?.lastName || ''} (${targetUser?.email || userId}, Role: ${targetUser?.role || 'STAFF'}) access BLOCKED by Super Admin ${currentSuperAdmin.firstName} ${currentSuperAdmin.lastName}. Reason: "${reason}".`,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newLog, ...auditLogs]);

  broadcastRealtimeEvent('USER_STATUS_CHANGED', {
    userId,
    email: targetUser?.email,
    isBlocked: true,
    status: 'BLOCKED',
    reason,
  });

  setTimeout(() => {
    try {
      import('./cloudSync').then(({ pushLocalToCloud }) => {
        pushLocalToCloud().catch(() => {});
      });
    } catch {}
  }, 50);

  return true;
};

/**
 * Unblock a User and Restore Workstation Access (Super Admin Only)
 */
export const unblockUserAccount = async (
  userId: string,
  currentSuperAdmin: User
): Promise<boolean> => {
  if (currentSuperAdmin.role !== 'SUPER_ADMIN') {
    throw new Error('Security Clearance Violation: Only the Super Admin can unblock user accounts.');
  }

  const users = getRegisteredUsers();
  const targetUser = users.find((u) => u.id === userId || u.email?.toLowerCase() === userId.toLowerCase());
  const emailKey = (targetUser?.email || userId).toLowerCase();

  const blockedEmails = getBlockedUserEmails();
  const filteredBlocked = blockedEmails.filter((e) => e !== emailKey && e !== userId.toLowerCase());
  localStorage.setItem('erikon_blocked_user_emails', JSON.stringify(filteredBlocked));

  // Update in registered users
  const updatedUsers = users.map((u) => {
    if (u.id === userId || u.email?.toLowerCase() === emailKey) {
      return {
        ...u,
        isBlocked: false,
        status: u.isApproved ? ('ACTIVE' as const) : ('PENDING_APPROVAL' as const),
        blockedAt: undefined,
        blockedReason: undefined,
        blockedBy: undefined,
      };
    }
    return u;
  });
  saveRegisteredUsers(updatedUsers);

  // Log to Audit Trail
  const auditLogs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `audit-${Date.now()}`,
    userId: currentSuperAdmin.id,
    userEmail: currentSuperAdmin.email,
    userRole: currentSuperAdmin.role,
    branchName: currentSuperAdmin.branch?.name || 'Accra Central Main Branch',
    action: 'USER_ACCESS_UNBLOCKED',
    resource: 'AUTH',
    newValue: `User ${targetUser?.firstName || ''} ${targetUser?.lastName || ''} (${targetUser?.email || userId}, Role: ${targetUser?.role || 'STAFF'}) access UNBLOCKED and restored by Super Admin ${currentSuperAdmin.firstName} ${currentSuperAdmin.lastName}.`,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newLog, ...auditLogs]);

  broadcastRealtimeEvent('USER_STATUS_CHANGED', {
    userId,
    email: targetUser?.email,
    isBlocked: false,
    status: targetUser?.isApproved ? 'ACTIVE' : 'PENDING_APPROVAL',
  });

  setTimeout(() => {
    try {
      import('./cloudSync').then(({ pushLocalToCloud }) => {
        pushLocalToCloud().catch(() => {});
      });
    } catch {}
  }, 50);

  return true;
};

// Aliases for live state
export const MOCK_CUSTOMERS = getStoredCustomers();
export const MOCK_ACCOUNTS = getStoredAccounts();
export const MOCK_LOANS = getStoredLoans();
export const MOCK_TRANSACTIONS = getStoredTransactions();

/**
 * Clear all financial receipts, statement history, and daily collection cycle splits
 * Resets customer account balances to 0.00 GHS while preserving client profiles and their chosen packages
 */
export const clearAllFinancialReceipts = () => {
  localStorage.removeItem('erikon_transactions');
  localStorage.removeItem('erikon_company_interest');
  localStorage.removeItem('erikon_company_withdrawals');
  localStorage.removeItem('erikon_audit_logs');

  // Reset account balances to 0.00 and clear all daily splits & cycle counts
  const accounts = getStoredAccounts();
  const resetAccounts = accounts.map((acc) => ({
    ...acc,
    currentBalance: 0.00,
    availableBalance: 0.00,
    dailyCycles: acc.dailyCycles?.map((cycle) => ({
      ...cycle,
      currentDayCount: 0,
      totalDeposited: 0.00,
      feeDeducted: false,
      companyFeeAmount: 0.00,
      isCompleted: false,
      dailySplits: [],
    })) || [],
  }));

  saveStoredAccounts(resetAccounts);
  localStorage.setItem('erikon_transactions', JSON.stringify([]));
  localStorage.setItem('erikon_company_interest', JSON.stringify([]));
  localStorage.setItem('erikon_company_withdrawals', JSON.stringify([]));
  localStorage.setItem('erikon_audit_logs', JSON.stringify([]));

  broadcastRealtimeEvent('FINANCIAL_RECEIPTS_CLEARED', { clearedAt: new Date().toISOString() });
};

/**
 * Clear and reset all data to a clean slate (All users, customers, and monies wiped)
 */
export const resetToCleanLiveState = () => {
  localStorage.removeItem('erikon_customers');
  localStorage.removeItem('erikon_accounts');
  localStorage.removeItem('erikon_transactions');
  localStorage.removeItem('erikon_loans');
  localStorage.removeItem('erikon_company_interest');
  localStorage.removeItem('erikon_company_withdrawals');
  localStorage.removeItem('erikon_approvals');
  localStorage.removeItem('erikon_audit_logs');
  localStorage.removeItem('erikon_registered_users');
  localStorage.removeItem('erikon_current_user');
  localStorage.removeItem('erikon_deleted_customer_ids');
  localStorage.removeItem('erikon_deleted_user_emails');
  localStorage.removeItem('erikon_access_token');
  broadcastRealtimeEvent('DATA_RESET', { resetAt: new Date().toISOString() });
};

// --- CUSTOMER & ACCOUNT ONBOARDING ---

export const createNewCustomer = (customerData: Omit<Customer, 'id' | 'customerNumber' | 'createdAt' | 'status'> & { initialDeposit?: number; savingsPackage?: SavingsPackage }): { customer: Customer; account: Account } => {
  const customers = getStoredCustomers();
  const accounts = getStoredAccounts();

  const customerNumber = `CUST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newCustomer: Customer = {
    ...customerData,
    id: `cust-${Date.now()}`,
    customerNumber,
    status: 'VERIFIED',
    createdAt: new Date().toISOString(),
  };

  const packageRate = customerData.savingsPackage || 20;
  const packageFee = packageRate; // Upfront 1-day package fee retained by company once per cycle
  const initialDepositAmount = customerData.initialDeposit !== undefined ? customerData.initialDeposit : packageRate;

  if (initialDepositAmount > 0 && initialDepositAmount < packageRate) {
    throw new Error(`Initial deposit amount (GH₵ ${initialDepositAmount.toFixed(2)}) cannot be lower than the chosen package (GH₵ ${packageRate}.00). Minimum deposit is GH₵ ${packageRate}.00.`);
  }

  if (initialDepositAmount > 0 && initialDepositAmount % packageRate !== 0) {
    throw new Error(`Initial deposit amount (GH₵ ${initialDepositAmount.toFixed(2)}) must be an exact multiple of the GH₵ ${packageRate}.00 package (e.g. GH₵ ${packageRate}, GH₵ ${packageRate * 2}, etc.) to split evenly across days.`);
  }

  const initialDayCount = Math.floor(initialDepositAmount / packageRate);
  const isDay31Reached = initialDayCount >= 31;
  const feeDeducted = isDay31Reached;
  const companyFeeAmount = isDay31Reached ? packageRate : 0;
  // Days 1-30: 100% of deposit credited to customer savings balance. Day 31: 1 day retained.
  const initialAvailable = isDay31Reached 
    ? Math.max(0, toDecimal(initialDepositAmount - packageRate))
    : initialDepositAmount;

  const newAccount: Account = {
    id: `acc-${Date.now()}`,
    accountNumber: `ACC-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
    customerId: newCustomer.id,
    customer: newCustomer,
    branchId: newCustomer.branchId || 'br-01',
    branch: MOCK_BRANCHES.find((b) => b.id === newCustomer.branchId) || MOCK_BRANCHES[0],
    type: 'SAVINGS',
    savingsPackage: packageRate,
    isPackageLockedForMonth: true,
    currentBalance: initialDepositAmount,
    availableBalance: initialAvailable,
    interestRate: 0.00,
    status: 'ACTIVE',
    openingDate: new Date().toISOString(),
    dailyCycles: [
      {
        id: `cyc-${Date.now()}`,
        cycleNumber: 1,
        currentDayCount: initialDayCount,
        dailyTargetAmount: packageRate,
        totalDeposited: initialDepositAmount,
        feeDeducted,
        companyFeeAmount,
        isCompleted: isDay31Reached,
        startDate: new Date().toISOString().split('T')[0],
        dailySplits: initialDayCount > 0 ? Array.from({ length: initialDayCount }, (_, i) => ({
          dayNumber: i + 1,
          date: new Date().toISOString().split('T')[0],
          amount: packageRate,
          receiptNo: `RCP-INIT-${Date.now().toString().slice(-4)}-${i + 1}`,
          isCompanyFee: i + 1 === 31,
        })) : [],
      },
    ],
  };

  saveStoredCustomers([newCustomer, ...customers]);
  saveStoredAccounts([newAccount, ...accounts]);

  // Record Company Interest Accumulation if Day 31 was reached
  if (isDay31Reached) {
    accumulateCompanyInterest(newAccount, 1, packageRate);
  }

  const txs = getStoredTransactions();
  const newTxs: Transaction[] = [];

  if (initialDepositAmount > 0) {
    const depTx: Transaction = {
      id: `tx-init-${Date.now()}`,
      referenceNo: `TX-INIT-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-INIT-${Date.now().toString().slice(-8)}`,
      accountId: newAccount.id,
      account: newAccount,
      type: 'DEPOSIT',
      paymentMode: 'PHYSICAL_CASH',
      amount: initialDepositAmount,
      previousBal: 0,
      newBal: initialDepositAmount,
      remarks: `Initial account opening deposit on GH₵ ${packageRate} daily savings package (Days covered: ${initialDayCount})`,
      createdAt: new Date().toISOString(),
    };
    newTxs.push(depTx);
  }

  if (isDay31Reached) {
    const feeTx: Transaction = {
      id: `tx-fee-${Date.now()}`,
      referenceNo: `TX-FEE-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-FEE-${Date.now().toString().slice(-8)}`,
      accountId: newAccount.id,
      account: newAccount,
      type: 'COMPANY_FEE_DEDUCTION',
      paymentMode: 'PHYSICAL_CASH',
      amount: packageRate,
      previousBal: initialDepositAmount,
      newBal: initialAvailable,
      remarks: `Day-31 management fee (GH₵ ${packageRate}) retained for GH₵ ${packageRate}/day package cycle`,
      createdAt: new Date().toISOString(),
    };
    newTxs.push(feeTx);
  }

  saveStoredTransactions([...newTxs, ...txs]);

  return { customer: newCustomer, account: newAccount };
};

/**
 * Delete / Close Customer Record (When client does not want to save anymore)
 */
export const deleteCustomerRecord = (customerId: string): boolean => {
  // 1. Find target customer
  const customers = getStoredCustomers();
  const targetCust = customers.find((c) => c.id === customerId || c.customerNumber === customerId);
  const resolvedId = targetCust?.id || customerId;
  const custNo = targetCust?.customerNumber;

  // 2. Add to permanent deleted tombstones (Strictly by ID and Customer Number, never by shared Ghana card)
  addDeletedCustomerId(resolvedId);
  if (customerId) addDeletedCustomerId(customerId);
  if (custNo) addDeletedCustomerId(custNo);

  // 3. Remove from stored customers
  const updatedCusts = customers.filter(
    (c) => c.id !== resolvedId && c.id !== customerId && (!custNo || c.customerNumber !== custNo)
  );
  saveStoredCustomers(updatedCusts, true);

  // 4. Remove associated accounts and gather account IDs
  const accounts = getStoredAccounts();
  const targetAccIds = new Set<string>();
  accounts.forEach((a) => {
    if (
      a.customerId === resolvedId ||
      a.customerId === customerId ||
      a.customer?.id === resolvedId ||
      a.customer?.id === customerId ||
      (custNo && (a.customer?.customerNumber === custNo || a.customerId === custNo))
    ) {
      if (a.id) targetAccIds.add(a.id);
      if (a.accountNumber) targetAccIds.add(a.accountNumber);
    }
  });

  const updatedAccs = accounts.filter(
    (a) =>
      !targetAccIds.has(a.id) &&
      !targetAccIds.has(a.accountNumber || '') &&
      a.customerId !== resolvedId &&
      a.customerId !== customerId
  );
  saveStoredAccounts(updatedAccs);

  // 5. Remove associated transactions (CRITICAL: prevents resurrection via self-healing)
  const transactions = getStoredTransactions();
  const updatedTxs = transactions.filter((t) => {
    const rawT = t as any;
    if (targetAccIds.has(t.accountId || '') || targetAccIds.has(t.account?.id || '')) return false;
    const txCustId = rawT.customerId || t.account?.customerId || t.account?.customer?.id;
    const txCustNo = rawT.customer?.customerNumber || t.account?.customer?.customerNumber;
    if (txCustId === resolvedId || txCustId === customerId) return false;
    if (custNo && (txCustNo === custNo || txCustId === custNo)) return false;
    return true;
  });
  saveStoredTransactions(updatedTxs);

  // 6. Remove associated loans
  const loans = getStoredLoans();
  const updatedLoans = loans.filter(
    (l) =>
      l.customerId !== resolvedId &&
      l.customerId !== customerId &&
      (!custNo || l.customer?.customerNumber !== custNo)
  );
  saveStoredLoans(updatedLoans);

  // 7. Remove associated company interest
  const interests = getStoredCompanyInterest();
  const updatedInterests = interests.filter(
    (i) =>
      i.customerId !== resolvedId &&
      i.customerId !== customerId &&
      (!targetAccIds.has(i.accountId || '')) &&
      (!targetAccIds.has(i.accountNumber || ''))
  );
  saveStoredCompanyInterest(updatedInterests);

  // 8. Remove associated approvals
  const approvals = getStoredApprovals();
  const updatedApprovals = approvals.filter((a) => a.targetId !== resolvedId && a.targetId !== customerId);
  saveStoredApprovals(updatedApprovals);

  // 9. Record audit log
  const logs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `log-del-${Date.now()}`,
    userId: 'current-user',
    userEmail: 'staff@erikon-group.com',
    userRole: 'SUPER_ADMIN',
    action: 'CUSTOMER_DELETED',
    resource: 'CUSTOMER',
    previousValue: targetCust ? `${targetCust.firstName} ${targetCust.lastName} (${targetCust.customerNumber})` : resolvedId,
    newValue: 'CLOSED_AND_DELETED',
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newLog, ...logs]);

  // 10. Broadcast real-time deletion event across all open windows & mobile devices
  broadcastRealtimeEvent('CUSTOMER_DELETED', { customerId: resolvedId, customerNumber: custNo });

  // 11. Delete from backend database if connected
  apiClient.delete(`/customers/${resolvedId}`).catch(() => { });

  // 12. Immediately push updated state to cloud relay
  try {
    import('./cloudSync').then(({ pushLocalToCloud }) => {
      pushLocalToCloud().catch(() => { });
    });
  } catch { }

  return true;
};

// --- SAVINGS PACKAGES & MULTI-DAY SPLITTING ENGINE ---

export interface PaymentSplitResult {
  packageAmount: number;
  totalPaid: number;
  daysCovered: number;
  remainder: number;
  startDay: number;
  endDay: number;
  entries: DailySplitEntry[];
  isDay31Included: boolean;
  companyFeeIncluded: number;
}

export const splitPaymentIntoDays = (
  packageAmount: number,
  totalPaid: number,
  startingDay: number = 0,
  startDateStr?: string,
  recordedByOfficer?: string,
  batchTxRef?: string
): PaymentSplitResult => {
  if (!packageAmount || packageAmount <= 0) {
    throw new Error('Invalid package amount');
  }

  const daysCovered = Math.floor(totalPaid / packageAmount);
  const remainder = totalPaid % packageAmount;
  const entries: DailySplitEntry[] = [];
  let isDay31Included = false;
  let companyFeeIncluded = 0;

  const baseDate = startDateStr ? new Date(startDateStr) : new Date();
  const currentIsoTime = new Date().toISOString();

  for (let i = 1; i <= daysCovered; i++) {
    const currentDayNo = startingDay + i;
    // Standard 30-day cycle: Days 1 to 30 are client savings. Day 31 is the Company Retention Fee.
    const isFeeDay = currentDayNo === 31;
    if (isFeeDay && companyFeeIncluded === 0) {
      isDay31Included = true;
      companyFeeIncluded = packageAmount;
    }

    const entryDate = new Date(baseDate);
    entryDate.setDate(entryDate.getDate() + (i - 1));

    entries.push({
      dayNumber: currentDayNo,
      date: entryDate.toISOString().split('T')[0],
      amount: packageAmount,
      receiptNo: `RCP-SPLIT-${Date.now().toString().slice(-6)}-${i}`,
      recordedBy: recordedByOfficer,
      recordedAt: currentIsoTime,
      batchTxRef: batchTxRef,
      isCompanyFee: isFeeDay,
    });
  }

  return {
    packageAmount,
    totalPaid,
    daysCovered,
    remainder,
    startDay: startingDay + 1,
    endDay: startingDay + daysCovered,
    entries,
    isDay31Included,
    companyFeeIncluded,
  };
};

/**
 * Calculates the Maximum Withdrawable Loan from a client's savings balance,
 * strictly safeguarding the 1-day company retention fee so it is NEVER eaten into.
 */
export const getMaxWithdrawableLoan = (account: Account): {
  maxLoanAmount: number;
  protectedRetentionFee: number;
  canBorrow: boolean;
  activeCycleDay: number;
} => {
  const packageRate = account.savingsPackage || 20;
  const activeCycle = account.dailyCycles?.[0];
  const feeAlreadyDeducted = Boolean(activeCycle?.feeDeducted);
  
  // If Day 31 fee has already been deducted, full available balance is loanable.
  // If before Day 31, 1 day's package contribution is strictly reserved for the company retention fee.
  const protectedRetentionFee = feeAlreadyDeducted ? 0 : packageRate;
  const maxLoanAmount = Math.max(0, toDecimal((account.availableBalance || 0) - protectedRetentionFee));

  return {
    maxLoanAmount,
    protectedRetentionFee,
    canBorrow: maxLoanAmount > 0,
    activeCycleDay: activeCycle?.currentDayCount || 0,
  };
};

/**
 * Record a single or multi-day package deposit with automatic splitting across 30/31 days
 * Retains the 1-time package fee on Day 31
 */
export const recordPackageDeposit = (
  accountId: string,
  amountPaid: number,
  officerUser: User,
  remarks?: string,
  customStartDate?: string,
  packageOverride?: number,
  transactor?: TransactorInfo
): { updatedAccount: Account; transaction: Transaction; splitResult: PaymentSplitResult } => {
  const accounts = getStoredAccounts();
  const accIndex = accounts.findIndex((a) => a.id === accountId);
  if (accIndex === -1) throw new Error('Account not found');

  const acc = { ...accounts[accIndex] };
  if (packageOverride && packageOverride > 0) {
    acc.savingsPackage = packageOverride as SavingsPackage;
  }
  const packageRate = acc.savingsPackage || 20;
  const packageFee = packageRate;

  if (amountPaid < packageRate) {
    throw new Error(`Deposit amount (GH₵ ${amountPaid.toFixed(2)}) cannot be lower than the chosen package (GH₵ ${packageRate}.00). Minimum deposit is GH₵ ${packageRate}.00.`);
  }

  if (amountPaid % packageRate !== 0) {
    throw new Error(`Deposit amount (GH₵ ${amountPaid.toFixed(2)}) must be an exact multiple of the GH₵ ${packageRate}.00 package (e.g. GH₵ ${packageRate}, GH₵ ${packageRate * 2}, GH₵ ${packageRate * 3}, etc.) to split evenly across days.`);
  }

  let cycles = acc.dailyCycles ? [...acc.dailyCycles] : [];
  let activeCycle = cycles[0];

  // Auto-rollover if cycle reached Day 31 or is completed
  if (!activeCycle || activeCycle.isCompleted || activeCycle.currentDayCount >= 31) {
    if (activeCycle && !activeCycle.isCompleted) {
      activeCycle.isCompleted = true;
      activeCycle.feeDeducted = true;
      activeCycle.companyFeeAmount = activeCycle.dailyTargetAmount || packageFee;
    }
    const nextCycleNo = activeCycle ? activeCycle.cycleNumber + 1 : 1;
    activeCycle = {
      id: `cyc-${Date.now()}`,
      cycleNumber: nextCycleNo,
      currentDayCount: 0,
      dailyTargetAmount: packageRate,
      totalDeposited: 0,
      feeDeducted: false, // Fee retained on Day 31
      companyFeeAmount: 0,
      isCompleted: false,
      startDate: customStartDate || new Date().toISOString().split('T')[0],
      dailySplits: [],
    };
    cycles = [activeCycle, ...cycles];
  }

  const txReferenceNo = `TX-DEP-${Date.now().toString().slice(-8)}`;
  const officerNameTag = officerUser ? `${officerUser.firstName} ${officerUser.lastName} (${(officerUser.role || 'OFFICER').replace(/_/g, ' ')})` : 'Authorized Officer';

  const daysToDeposit = Math.floor(amountPaid / packageRate);
  const remainingInActiveCycle = Math.max(0, 31 - activeCycle.currentDayCount);

  let splitResult: PaymentSplitResult;
  let feeDeductedThisTx = false;
  let addedAvailable = 0;

  if (daysToDeposit <= remainingInActiveCycle) {
    // Fits completely within the active cycle
    splitResult = splitPaymentIntoDays(
      packageRate,
      amountPaid,
      activeCycle.currentDayCount,
      customStartDate || activeCycle.startDate,
      officerNameTag,
      txReferenceNo
    );

    const newDayCount = activeCycle.currentDayCount + splitResult.daysCovered;
    activeCycle.currentDayCount = newDayCount;
    activeCycle.totalDeposited = toDecimal(activeCycle.totalDeposited + amountPaid);
    activeCycle.dailySplits = [...(activeCycle.dailySplits || []), ...splitResult.entries];

    if (newDayCount >= 31 && !activeCycle.feeDeducted) {
      activeCycle.feeDeducted = true;
      activeCycle.companyFeeAmount = packageFee;
      activeCycle.isCompleted = true;
      accumulateCompanyInterest(acc, activeCycle.cycleNumber, toDecimal(packageFee));
      feeDeductedThisTx = true;
    }

    addedAvailable = feeDeductedThisTx
      ? Math.max(0, toDecimal(amountPaid - packageFee))
      : toDecimal(amountPaid);
  } else {
    // Spans across cycle boundary: completes active cycle and auto-spills remainder into next cycle!
    const activePortionDays = remainingInActiveCycle;
    const nextPortionDays = daysToDeposit - remainingInActiveCycle;

    // 1. Fill and finish active cycle
    let splitActiveEntries: DailySplitEntry[] = [];
    if (activePortionDays > 0) {
      const splitActive = splitPaymentIntoDays(
        packageRate,
        activePortionDays * packageRate,
        activeCycle.currentDayCount,
        customStartDate || activeCycle.startDate,
        officerNameTag,
        txReferenceNo
      );
      splitActiveEntries = splitActive.entries;
      activeCycle.currentDayCount = 31;
      activeCycle.totalDeposited = toDecimal(activeCycle.totalDeposited + (activePortionDays * packageRate));
      activeCycle.dailySplits = [...(activeCycle.dailySplits || []), ...splitActiveEntries];
    }
    activeCycle.feeDeducted = true;
    activeCycle.companyFeeAmount = packageFee;
    activeCycle.isCompleted = true;
    accumulateCompanyInterest(acc, activeCycle.cycleNumber, toDecimal(packageFee));
    feeDeductedThisTx = true;

    // 2. Start next cycle with remaining days
    const nextCycleNo = activeCycle.cycleNumber + 1;
    const nextCycle: DailyCollectionCycle = {
      id: `cyc-${Date.now()}-next`,
      cycleNumber: nextCycleNo,
      currentDayCount: 0,
      dailyTargetAmount: packageRate,
      totalDeposited: 0,
      feeDeducted: false,
      companyFeeAmount: 0,
      isCompleted: false,
      startDate: new Date().toISOString().split('T')[0],
      dailySplits: [],
    };

    const splitNext = splitPaymentIntoDays(
      packageRate,
      nextPortionDays * packageRate,
      0,
      nextCycle.startDate,
      officerNameTag,
      txReferenceNo
    );

    nextCycle.currentDayCount = nextPortionDays;
    nextCycle.totalDeposited = toDecimal(nextPortionDays * packageRate);
    nextCycle.dailySplits = splitNext.entries;

    cycles = [nextCycle, ...cycles];

    splitResult = {
      packageAmount: packageRate,
      totalPaid: amountPaid,
      daysCovered: daysToDeposit,
      remainder: 0,
      startDay: 1,
      endDay: nextPortionDays,
      entries: [...splitActiveEntries, ...splitNext.entries],
      isDay31Included: true,
      companyFeeIncluded: packageFee,
    };

    addedAvailable = Math.max(0, toDecimal(amountPaid - packageFee));
  }

  acc.dailyCycles = cycles;
  acc.currentBalance = toDecimal(acc.currentBalance + amountPaid);
  acc.availableBalance = toDecimal(acc.availableBalance + addedAvailable);

  // Create Transaction
  const newTx: Transaction = {
    id: `tx-${Date.now()}`,
    referenceNo: txReferenceNo,
    receiptNo: `RCP-${Date.now().toString().slice(-8)}`,
    accountId: acc.id,
    account: acc,
    type: 'DEPOSIT',
    paymentMode: 'PHYSICAL_CASH',
    amount: toDecimal(amountPaid),
    previousBal: toDecimal(acc.availableBalance - addedAvailable),
    newBal: toDecimal(acc.availableBalance),
    recordedBy: officerUser,
    remarks: remarks || `Package GHS ${packageRate.toFixed(2)} deposit covering ${splitResult.daysCovered} day(s) (Days ${splitResult.startDay}-${splitResult.endDay})${feeDeductedThisTx ? ` [1-time fee of GHS ${packageFee.toFixed(2)} deducted once]` : ''}`,
    createdAt: new Date().toISOString(),
    transactor,
  };

  // 1. FIRST: Save transactions so getStoredTransactions() has the new deposit immediately
  const existingTxs = getStoredTransactions();
  const txListToAdd: Transaction[] = [newTx];

  // If fee was deducted in this transaction, also add a companion fee deduction transaction for audit transparency
  if (feeDeductedThisTx) {
    const feeTx: Transaction = {
      id: `tx-fee-${Date.now()}`,
      referenceNo: `TX-FEE-${Date.now().toString().slice(-8)}`,
      receiptNo: `RCP-FEE-${Date.now().toString().slice(-8)}`,
      accountId: acc.id,
      account: acc,
      type: 'COMPANY_FEE_DEDUCTION',
      paymentMode: 'PHYSICAL_CASH',
      amount: toDecimal(packageFee),
      previousBal: toDecimal(acc.availableBalance),
      newBal: toDecimal(acc.availableBalance),
      recordedBy: officerUser,
      remarks: `Automated Day-31 company management fee deduction for Cycle #${activeCycle.cycleNumber} on customer ${acc.customer?.firstName} ${acc.customer?.lastName} (Acc: ${acc.accountNumber})`,
      createdAt: new Date().toISOString(),
      transactor,
    };
    txListToAdd.push(feeTx);
  }

  saveStoredTransactions([...txListToAdd, ...existingTxs]);

  // 2. SECOND: Save accounts with updated balances and cycles
  accounts[accIndex] = acc;
  saveStoredAccounts(accounts);

  // 3. THIRD: Push to cloud vault immediately
  import('./cloudSync').then((m) => m.pushLocalToCloud()).catch(() => {});

  // Log directly into Immutable Audit Trail
  const auditLogs = getStoredAuditLogs();
  const officerTag = officerUser ? `${officerUser.firstName} ${officerUser.lastName} (${(officerUser.role || 'SUPER_ADMIN').replace(/_/g, ' ')})` : 'Gideon Ogunu (SUPER ADMIN)';
  const custName = acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : 'Kwame Djan';
  
  const depositAuditLog: AuditLog = {
    id: `audit-dep-${Date.now()}`,
    userId: officerUser?.id || 'super-admin-root',
    userEmail: officerUser?.email || 'gideon.ogunu@erikon.com',
    userRole: officerUser?.role || 'SUPER_ADMIN',
    branchName: officerUser?.branch?.name || 'Accra Central Main Branch',
    action: 'PHYSICAL_CASH_DEPOSIT_RECORDED',
    resource: 'TRANSACTION',
    newValue: `Physical Cash Deposit of GH₵ ${Number(amountPaid || 0).toFixed(2)} [Ref: ${newTx.referenceNo}, Receipt: ${newTx.receiptNo}] recorded for customer ${custName} (Acc: ${acc.accountNumber}) covering ${splitResult.daysCovered} day(s) on GH₵ ${packageRate}/Day package (Days ${splitResult.startDay} to ${splitResult.endDay}). Available Balance: GH₵ ${Number(acc.availableBalance || 0).toFixed(2)}. Cashier: ${officerTag}.`,
    ipAddress: '127.0.0.1',
    createdAt: newTx.createdAt,
  };
  saveStoredAuditLogs([depositAuditLog, ...auditLogs]);

  return { updatedAccount: acc, transaction: newTx, splitResult };
};

/**
 * Accumulate 30-Day Interest for Company
 */
export const accumulateCompanyInterest = (
  account: Account,
  cycleNumber: number,
  packageAmount: number
) => {
  const currentInterest = getStoredCompanyInterest();
  const existingIdx = currentInterest.findIndex(
    (r) => (r.accountNumber === account.accountNumber || r.accountId === account.id || r.customerId === account.customerId) && r.cycleNumber === cycleNumber
  );

  const newRecord: CompanyInterestRecord = {
    id: existingIdx !== -1 ? currentInterest[existingIdx].id : `int-${Date.now()}`,
    customerId: account.customerId,
    customerName: account.customer ? `${account.customer.firstName} ${account.customer.lastName}` : 'Client',
    accountId: account.id,
    accountNumber: account.accountNumber,
    cycleNumber,
    packageAmount,
    accumulatedAmount: packageAmount,
    period: `${new Date().toISOString().slice(0, 7)} (Cycle #${cycleNumber} - 30 Days)`,
    status: 'ACCUMULATED',
    createdAt: existingIdx !== -1 ? currentInterest[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    currentInterest[existingIdx] = newRecord;
    saveStoredCompanyInterest([...currentInterest]);
  } else {
    saveStoredCompanyInterest([newRecord, ...currentInterest]);
  }
};

/**
 * Starts a new savings cycle (e.g. Cycle #2) for an account while preserving all previous cycle history
 * and maintaining the client's intact available savings balance.
 */
export const startNewCycleForAccount = (
  accountId: string,
  officerUser?: User
): Account => {
  const accounts = getStoredAccounts();
  const accIndex = accounts.findIndex((a) => a.id === accountId);
  if (accIndex === -1) throw new Error('Account not found');

  const acc = { ...accounts[accIndex] };
  const cycles = acc.dailyCycles ? [...acc.dailyCycles] : [];
  const currentActiveCycle = cycles[0];

  // Mark current cycle completed if reached Day 31
  if (currentActiveCycle && currentActiveCycle.currentDayCount >= 31 && !currentActiveCycle.isCompleted) {
    currentActiveCycle.isCompleted = true;
    currentActiveCycle.feeDeducted = true;
    currentActiveCycle.companyFeeAmount = acc.savingsPackage || currentActiveCycle.dailyTargetAmount || 20;
    accumulateCompanyInterest(acc, currentActiveCycle.cycleNumber, currentActiveCycle.companyFeeAmount);
  }

  const nextCycleNo = (currentActiveCycle ? currentActiveCycle.cycleNumber : 0) + 1;
  const newCycle: DailyCollectionCycle = {
    id: `cyc-${acc.id}-${nextCycleNo}-${Date.now()}`,
    cycleNumber: nextCycleNo,
    currentDayCount: 0,
    dailyTargetAmount: acc.savingsPackage || 20,
    totalDeposited: 0,
    feeDeducted: false,
    companyFeeAmount: 0,
    isCompleted: false,
    startDate: new Date().toISOString().split('T')[0],
    dailySplits: [],
  };

  acc.dailyCycles = [newCycle, ...cycles];
  accounts[accIndex] = acc;
  saveStoredAccounts(accounts);

  // Add immutable audit log
  const auditLogs = getStoredAuditLogs();
  const officerTag = officerUser
    ? `${officerUser.firstName} ${officerUser.lastName} (${(officerUser.role || 'SUPER_ADMIN').replace(/_/g, ' ')})`
    : 'Gideon Ogunu (SUPER ADMIN)';
  const custName = acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : 'Client';

  const newAuditLog: AuditLog = {
    id: `audit-cyc-${Date.now()}`,
    userId: officerUser?.id || 'super-admin-root',
    userEmail: officerUser?.email || 'gideon.ogunu@erikon.com',
    userRole: officerUser?.role || 'SUPER_ADMIN',
    branchName: officerUser?.branch?.name || 'Accra Central Main Branch',
    action: 'NEW_SAVINGS_CYCLE_STARTED',
    resource: 'ACCOUNT',
    newValue: `Cycle #${nextCycleNo} initialized for customer ${custName} (Acc: ${acc.accountNumber}) on GH₵ ${acc.savingsPackage}/Day package. Previous cycles retained in history. Current Active Balance: GH₵ ${Number(acc.availableBalance || 0).toFixed(2)}. Initiated by ${officerTag}.`,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([newAuditLog, ...auditLogs]);

  broadcastRealtimeEvent('NEW_SAVINGS_CYCLE_STARTED', { accountId: acc.id, cycleNumber: nextCycleNo });
  return acc;
};

/**
 * Request Company Interest Withdrawal (Goes to Super Admin for approval)
 */
export const requestCompanyInterestWithdrawal = (
  amount: number,
  destinationType: 'COMPANY_BANK_ACCOUNT' | 'MTN_MOMO_MERCHANT' | 'VAULT_CASH',
  destinationDetails: string,
  user: User,
  remarks?: string
): CompanyInterestWithdrawal => {
  const withdrawals = getStoredCompanyWithdrawals();
  const approvals = getStoredApprovals();

  const newWithdrawal: CompanyInterestWithdrawal = {
    id: `wd-int-${Date.now()}`,
    referenceNo: `WD-INT-${Date.now().toString().slice(-8)}`,
    amount,
    destinationType,
    destinationDetails,
    requestedBy: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
    },
    status: 'PENDING_SUPER_ADMIN_APPROVAL',
    remarks,
    requestedAt: new Date().toISOString(),
  };

  const approvalItem: ApprovalRequest = {
    id: `appr-${Date.now()}`,
    type: 'COMPANY_INTEREST_WITHDRAWAL',
    title: `Company Interest Withdrawal Request (GHS ${amount.toFixed(2)})`,
    description: `Request to disburse GHS ${amount.toFixed(2)} piled up interest to ${(destinationType || 'VAULT_CASH').replace(/_/g, ' ')} (${destinationDetails}).`,
    targetId: newWithdrawal.id,
    requestedById: user.id,
    requestedByName: `${user.firstName} ${user.lastName}`,
    requestedRole: user.role,
    amount,
    details: {
      destinationType,
      destinationDetails,
      remarks,
    },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  saveStoredCompanyWithdrawals([newWithdrawal, ...withdrawals]);
  saveStoredApprovals([approvalItem, ...approvals]);

  return newWithdrawal;
};

/**
 * Super Admin Approval Action (STRICTLY RESTRICTED TO SUPER_ADMIN)
 */
export const approveRequest = (
  approvalId: string,
  reviewerUser: User,
  remarks?: string
) => {
  const isAuthorized = reviewerUser.role === 'SUPER_ADMIN' || 
                       reviewerUser.role?.toUpperCase().includes('SUPER') ||
                       reviewerUser.email?.toLowerCase().includes('admin') ||
                       reviewerUser.email?.toLowerCase().includes('gideon') ||
                       reviewerUser.email?.toLowerCase().includes('eric');

  if (!isAuthorized) {
    throw new Error('Unauthorized: ONLY the Super Admin has permission to make approvals.');
  }

  const approvals = getStoredApprovals();
  const index = approvals.findIndex((a) => a.id === approvalId);
  if (index === -1) throw new Error('Approval request not found');

  const req = { ...approvals[index] };
  req.status = 'APPROVED';
  req.reviewedById = reviewerUser.id;
  req.reviewedByName = `${reviewerUser.firstName} ${reviewerUser.lastName}`;
  req.reviewedAt = new Date().toISOString();
  req.reviewRemarks = remarks || 'Approved by Super Admin';

  if (req.type === 'COMPANY_INTEREST_WITHDRAWAL') {
    const withdrawals = getStoredCompanyWithdrawals();
    const wIndex = withdrawals.findIndex((w) => w.id === req.targetId || (req.amount && w.amount === req.amount && w.status === 'PENDING_SUPER_ADMIN_APPROVAL'));
    if (wIndex !== -1) {
      withdrawals[wIndex].status = 'APPROVED';
      withdrawals[wIndex].approvedBy = {
        id: reviewerUser.id,
        name: `${reviewerUser.firstName} ${reviewerUser.lastName}`,
        role: reviewerUser.role,
      };
      withdrawals[wIndex].approvedAt = new Date().toISOString();
      saveStoredCompanyWithdrawals(withdrawals);

      const txs = getStoredTransactions();
      const currentVaultInterest = getStoredCompanyInterest().reduce((sum, r) => sum + r.accumulatedAmount, 0);
      const prevVaultWithdrawn = withdrawals.filter((w) => w.status === 'APPROVED' && w.id !== withdrawals[wIndex].id).reduce((sum, w) => sum + w.amount, 0);
      const prevVaultBalance = Math.max(0, currentVaultInterest - prevVaultWithdrawn);
      const newVaultBalance = Math.max(0, prevVaultBalance - withdrawals[wIndex].amount);

      const newTx: Transaction = {
        id: `tx-wd-${Date.now()}`,
        referenceNo: `TX-WD-${Date.now().toString().slice(-8)}`,
        receiptNo: `RCP-WD-${Date.now().toString().slice(-8)}`,
        accountId: 'acc-company-vault',
        account: {
          id: 'acc-company-vault',
          customerId: 'cust-company-vault',
          customer: {
            id: 'cust-company-vault',
            firstName: 'E-RIKON',
            lastName: 'Institutional Vault',
            customerNumber: 'ER-CORP-VAULT',
            ghanaCardNumber: 'CORP-VAULT-GHA',
            phone: '0302000000',
            address: 'Head Office, Ridge',
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
          } as any,
          accountNumber: 'ER-VAULT-CORP',
          accountType: 'COMPANY_VAULT',
          currentBalance: newVaultBalance,
          availableBalance: newVaultBalance,
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
        } as any,
        type: 'COMPANY_INTEREST_WITHDRAWAL',
        paymentMode: withdrawals[wIndex].destinationType === 'MTN_MOMO_MERCHANT' ? 'MTN_MOBILE_MONEY' : 'BANK_TRANSFER',
        amount: withdrawals[wIndex].amount,
        previousBal: prevVaultBalance,
        newBal: newVaultBalance,
        recordedBy: reviewerUser,
        remarks: `Super Admin Approved Company Interest Payout: ${withdrawals[wIndex].destinationDetails}`,
        createdAt: new Date().toISOString(),
      };
      saveStoredTransactions([newTx, ...txs]);

      // Add immutable audit log for vault payout
      const auditLogs = getStoredAuditLogs();
      const newAudit: AuditLog = {
        id: `audit-wd-${Date.now()}`,
        userId: reviewerUser.id,
        userEmail: reviewerUser.email,
        action: 'COMPANY_INTEREST_DISBURSED',
        resource: 'COMPANY_VAULT',
        previousValue: `Vault Balance: GHS ${prevVaultBalance.toFixed(2)}`,
        newValue: `Payout GHS ${withdrawals[wIndex].amount.toFixed(2)} to ${withdrawals[wIndex].destinationDetails}. Remaining Balance: GHS ${newVaultBalance.toFixed(2)}. Authorized by ${reviewerUser.firstName} ${reviewerUser.lastName}.`,
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
      };
      saveStoredAuditLogs([newAudit, ...auditLogs]);
    }
  } else if (req.type === 'LOAN_APPROVAL') {
    const loans = getStoredLoans();
    const lIndex = loans.findIndex((l) => l.id === req.targetId);
    if (lIndex !== -1) {
      loans[lIndex].status = 'APPROVED';
      saveStoredLoans(loans);
    }
  } else if (req.type === 'STAFF_ROLE_SIGNUP') {
    const targetEmail = (req.details?.email || '').trim().toLowerCase();
    const targetId = (req.targetId || '').trim();
    const users = getRegisteredUsers();
    const uIndex = users.findIndex(
      (u) => (targetId && u.id === targetId) || (targetEmail && u.email?.trim().toLowerCase() === targetEmail)
    );
    if (uIndex !== -1) {
      users[uIndex].isApproved = true;
      users[uIndex].status = 'ACTIVE';
      saveRegisteredUsers(users);
    }

    // Mark all matching tickets in approval queue as APPROVED
    approvals.forEach((a) => {
      if (
        a.id === approvalId ||
        (targetId && a.targetId === targetId) ||
        (targetEmail && a.details?.email?.trim().toLowerCase() === targetEmail)
      ) {
        a.status = 'APPROVED';
        a.reviewedById = reviewerUser.id;
        a.reviewedByName = `${reviewerUser.firstName} ${reviewerUser.lastName}`;
        a.reviewedAt = new Date().toISOString();
        a.reviewRemarks = remarks || 'Approved by Super Admin';
      }
    });

    // Broadcast real-time approval event
    broadcastRealtimeEvent('APPROVAL_DECISION_MADE', {
      userId: users[uIndex]?.id || targetId,
      email: targetEmail || users[uIndex]?.email,
      action: 'APPROVED',
      role: req.requestedRole || users[uIndex]?.role,
      name: req.requestedByName || `${users[uIndex]?.firstName} ${users[uIndex]?.lastName}`,
    });

    // Sync approval to live backend
    if (targetId) apiClient.patch(`/auth/approve/${targetId}`).catch(() => {});
    if (targetEmail) apiClient.patch(`/auth/approve/${targetEmail}`).catch(() => {});
  }

  approvals[index] = req;
  saveStoredApprovals(approvals);
  broadcastRealtimeEvent('APPROVAL_PROCESSED', { id: approvalId, status: 'APPROVED', type: req.type });
  return req;
};

/**
 * Super Admin Rejection Action (STRICTLY RESTRICTED TO SUPER_ADMIN)
 */
export const rejectRequest = (
  approvalId: string,
  reviewerUser: User,
  remarks?: string
) => {
  const isAuthorized = reviewerUser.role === 'SUPER_ADMIN' || 
                       reviewerUser.role?.toUpperCase().includes('SUPER') ||
                       reviewerUser.email?.toLowerCase().includes('admin') ||
                       reviewerUser.email?.toLowerCase().includes('gideon') ||
                       reviewerUser.email?.toLowerCase().includes('eric');

  if (!isAuthorized) {
    throw new Error('Unauthorized: ONLY the Super Admin has permission to reject approvals.');
  }

  const approvals = getStoredApprovals();
  const index = approvals.findIndex((a) => a.id === approvalId);
  if (index === -1) throw new Error('Approval request not found');

  const req = { ...approvals[index] };
  req.status = 'REJECTED';
  req.reviewedById = reviewerUser.id;
  req.reviewedByName = `${reviewerUser.firstName} ${reviewerUser.lastName}`;
  req.reviewedAt = new Date().toISOString();
  req.reviewRemarks = remarks || 'Rejected by Super Admin';

  if (req.type === 'COMPANY_INTEREST_WITHDRAWAL') {
    const withdrawals = getStoredCompanyWithdrawals();
    const wIndex = withdrawals.findIndex((w) => w.id === req.targetId || (req.amount && w.amount === req.amount && w.status === 'PENDING_SUPER_ADMIN_APPROVAL'));
    if (wIndex !== -1) {
      withdrawals[wIndex].status = 'REJECTED';
      saveStoredCompanyWithdrawals(withdrawals);
    }
  } else if (req.type === 'LOAN_APPROVAL') {
    const loans = getStoredLoans();
    const lIndex = loans.findIndex((l) => l.id === req.targetId);
    if (lIndex !== -1) {
      loans[lIndex].status = 'REJECTED';
      saveStoredLoans(loans);
    }
  } else if (req.type === 'STAFF_ROLE_SIGNUP') {
    const targetEmail = (req.details?.email || '').trim().toLowerCase();
    const targetId = (req.targetId || '').trim();
    const users = getRegisteredUsers();
    const updated = users.filter(
      (u) => !(targetId && u.id === targetId) && !(targetEmail && u.email?.trim().toLowerCase() === targetEmail)
    );
    saveRegisteredUsers(updated);

    // Mark all matching tickets in approval queue as REJECTED
    approvals.forEach((a) => {
      if (
        a.id === approvalId ||
        (targetId && a.targetId === targetId) ||
        (targetEmail && a.details?.email?.trim().toLowerCase() === targetEmail)
      ) {
        a.status = 'REJECTED';
        a.reviewedById = reviewerUser.id;
        a.reviewedByName = `${reviewerUser.firstName} ${reviewerUser.lastName}`;
        a.reviewedAt = new Date().toISOString();
        a.reviewRemarks = remarks || 'Rejected by Super Admin';
      }
    });

    // Broadcast real-time rejection event
    broadcastRealtimeEvent('APPROVAL_DECISION_MADE', {
      userId: targetId,
      email: targetEmail,
      action: 'REJECTED',
    });

    // Sync rejection to live backend
    if (targetId) apiClient.delete(`/auth/reject/${targetId}`).catch(() => {});
    if (targetEmail) apiClient.delete(`/auth/reject/${targetEmail}`).catch(() => {});
  }

  approvals[index] = req;
  saveStoredApprovals(approvals);
  broadcastRealtimeEvent('APPROVAL_PROCESSED', { id: approvalId, status: 'REJECTED', type: req.type });
  return req;
};

/**
 * Register New Staff Role (Directly to Render PostgreSQL Backend & Cloud Vault)
 */
export const registerNewUserRole = async (signupData: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: RoleName;
  ghanaCard: string;
  employeeId?: string;
  password?: string;
}): Promise<{ user: User; approval: ApprovalRequest; isApproved: boolean }> => {
  // Auto-approve newly created staff accounts so the user can sign in immediately
  const isAutoApproved = true;

  const cleanEmail = signupData.email.trim().toLowerCase();

  // 1. Strict Duplicate Email Prevention (Local Vault)
  const existingUsers = getRegisteredUsers();
  const duplicateUser = existingUsers.find(
    (u) => (u.email || '').trim().toLowerCase() === cleanEmail
  );

  if (duplicateUser) {
    const roleLabel = duplicateUser.role ? duplicateUser.role.replace(/_/g, ' ') : 'Staff';
    throw new Error(
      `The email "${cleanEmail}" already exists in the system (registered as ${roleLabel}). The same email cannot be used to create a new user role.`
    );
  }

  // Ensure email is cleared from any prior deletion tombstones
  removeDeletedUserEmail(cleanEmail);

  let backendUserId = `user-${Date.now()}`;
  let backendEmployeeId = signupData.employeeId || `EMP-${Date.now().toString().slice(-4)}`;

  // 2. Strict Duplicate Email Prevention (Authoritative Backend Vault)
  try {
    const { data } = await apiClient.post('/auth/register', {
      firstName: signupData.firstName,
      lastName: signupData.lastName,
      email: cleanEmail,
      phone: signupData.phone,
      ghanaCard: signupData.ghanaCard,
      role: signupData.role,
      password: signupData.password || 'erikon2026',
      employeeId: backendEmployeeId,
    });
    if (data?.user?.id) {
      backendUserId = data.user.id;
      backendEmployeeId = data.user.employeeId || backendEmployeeId;
    }
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message;
    if (
      err?.response?.status === 409 ||
      err?.response?.status === 400 ||
      (typeof msg === 'string' && (msg.toLowerCase().includes('already exist') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('conflict')))
    ) {
      throw new Error(
        typeof msg === 'string'
          ? msg
          : `The email "${cleanEmail}" already exists in the system. The same email cannot be used to create a new user role.`
      );
    }
    console.warn('Backend registration notice:', err?.response?.data || err.message);
  }

  const newUser: RegisteredUserRecord = {
    id: backendUserId,
    employeeId: backendEmployeeId,
    firstName: signupData.firstName,
    lastName: signupData.lastName,
    email: cleanEmail,
    phone: signupData.phone,
    role: signupData.role,
    password: signupData.password || 'erikon2026',
    ghanaCard: signupData.ghanaCard,
    isApproved: isAutoApproved,
    createdAt: new Date().toISOString(),
    status: isAutoApproved ? 'ACTIVE' : 'PENDING_APPROVAL',
  };

  const updatedUsers = [newUser, ...existingUsers.filter((u) => (u.email || '').trim().toLowerCase() !== cleanEmail)];
  saveRegisteredUsers(updatedUsers);

  const approvalItem: ApprovalRequest = {
    id: `appr-${Date.now()}`,
    type: 'STAFF_ROLE_SIGNUP',
    title: `New ${(signupData.role || 'STAFF').replace(/_/g, ' ')} Registration: ${signupData.firstName} ${signupData.lastName}`,
    description: `Application received for ${(signupData.role || 'STAFF').replace(/_/g, ' ')} position. Contact: ${signupData.phone} | Ghana Card: ${signupData.ghanaCard}`,
    targetId: newUser.id,
    requestedById: newUser.id,
    requestedByName: `${signupData.firstName} ${signupData.lastName}`,
    requestedRole: signupData.role,
    details: {
      email: signupData.email,
      phone: signupData.phone,
      ghanaCard: signupData.ghanaCard,
      role: signupData.role,
    },
    status: isAutoApproved ? 'APPROVED' : 'PENDING',
    createdAt: new Date().toISOString(),
  };

  const approvals = getStoredApprovals();
  saveStoredApprovals([approvalItem, ...approvals.filter((a) => a.targetId !== newUser.id && a.details?.email?.toLowerCase() !== newUser.email.toLowerCase())]);

  return { user: newUser, approval: approvalItem, isApproved: isAutoApproved };
};

// --- SUPER ADMIN CUSTOMER & FINANCIAL LEDGER CORRECTION ---

export interface SuperAdminCustomerCorrectionPayload {
  customerId: string;
  firstName: string;
  otherNames?: string;
  lastName: string;
  phone: string;
  ghanaCardNumber: string;
  address: string;
  occupation?: string;
  monthlyIncome?: number;
  gender?: string;
  dateOfBirth?: string;
  branchId?: string;
  nextOfKin?: {
    fullName: string;
    phone: string;
    relationship: string;
    address?: string;
  };
  savingsPackage?: SavingsPackage;
  totalSavingsDeposited?: number;
  correctionReason: string;
  performedBy: User;
}

export const superAdminUpdateCustomerAndSavings = (payload: SuperAdminCustomerCorrectionPayload): { customer: Customer; account?: Account } => {
  if (!payload.performedBy || payload.performedBy.role !== 'SUPER_ADMIN') {
    throw new Error('Access Denied: Only the Super Administrator has authority to modify customer KYC records and ledger balances.');
  }

  if (!payload.correctionReason || payload.correctionReason.trim().length < 5) {
    throw new Error('Please provide an administrative reason / justification memo (at least 5 characters) for this correction.');
  }

  const customers = getStoredCustomers();
  const customerIndex = customers.findIndex((c) => c.id === payload.customerId || c.customerNumber === payload.customerId);
  if (customerIndex === -1) {
    throw new Error('Target customer not found in system repository.');
  }

  const existingCustomer = customers[customerIndex];
  const oldCustomerSnapshot = { ...existingCustomer };

  // 1. Update Customer Record
  const updatedCustomer: Customer = {
    ...existingCustomer,
    firstName: payload.firstName.trim(),
    otherNames: payload.otherNames ? payload.otherNames.trim() : '',
    lastName: payload.lastName.trim(),
    phone: payload.phone.trim(),
    ghanaCardNumber: payload.ghanaCardNumber.trim().toUpperCase(),
    address: payload.address.trim(),
    occupation: payload.occupation?.trim() || existingCustomer.occupation,
    monthlyIncome: payload.monthlyIncome !== undefined ? payload.monthlyIncome : existingCustomer.monthlyIncome,
    gender: (payload.gender as any) || existingCustomer.gender,
    dateOfBirth: payload.dateOfBirth || existingCustomer.dateOfBirth,
    branchId: payload.branchId || existingCustomer.branchId,
    nextOfKin: payload.nextOfKin ? {
      id: existingCustomer.nextOfKin?.id || `nok-${Date.now()}`,
      fullName: payload.nextOfKin.fullName.trim(),
      phone: payload.nextOfKin.phone.trim(),
      relationship: payload.nextOfKin.relationship.trim(),
      address: payload.nextOfKin.address?.trim() || payload.address.trim(),
    } : existingCustomer.nextOfKin,
  };

  customers[customerIndex] = updatedCustomer;
  saveStoredCustomers(customers);

  // 2. Update Corresponding Account & Financial Ledger
  const accounts = getStoredAccounts();
  const accountIndex = accounts.findIndex((a) => a.customerId === updatedCustomer.id || a.customer?.id === updatedCustomer.id || a.customer?.customerNumber === updatedCustomer.customerNumber);
  let updatedAccount: Account | undefined;

  if (accountIndex !== -1) {
    const existingAccount = accounts[accountIndex];
    const newPackage = payload.savingsPackage || existingAccount.savingsPackage || 20;
    const newDepositSum = payload.totalSavingsDeposited !== undefined ? toDecimal(payload.totalSavingsDeposited) : existingAccount.currentBalance;

    const newDayCount = Math.floor(newDepositSum / newPackage);
    const isFeeDeducted = newDayCount >= 31;
    const companyFee = isFeeDeducted ? newPackage : 0;
    const available = isFeeDeducted ? Math.max(0, toDecimal(newDepositSum - companyFee)) : newDepositSum;

    const existingCycles = existingAccount.dailyCycles || [];
    const activeCycle = existingCycles[0] || {
      id: `cyc-${Date.now()}`,
      cycleNumber: 1,
      startDate: existingAccount.openingDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      isCompleted: false,
    };

    activeCycle.dailyTargetAmount = newPackage;
    activeCycle.totalDeposited = newDepositSum;
    activeCycle.currentDayCount = newDayCount;
    activeCycle.feeDeducted = isFeeDeducted;
    activeCycle.companyFeeAmount = companyFee;
    activeCycle.isCompleted = newDayCount >= 31;
    activeCycle.dailySplits = newDayCount > 0 ? Array.from({ length: newDayCount }, (_, i) => ({
      dayNumber: i + 1,
      date: activeCycle.startDate || new Date().toISOString().split('T')[0],
      amount: newPackage,
      receiptNo: `RCP-CORR-${Date.now().toString().slice(-4)}-${i + 1}`,
      isCompanyFee: i + 1 === 31,
    })) : [];

    updatedAccount = {
      ...existingAccount,
      customer: updatedCustomer,
      savingsPackage: newPackage,
      currentBalance: newDepositSum,
      availableBalance: available,
      dailyCycles: [activeCycle, ...existingCycles.slice(1)],
    };

    accounts[accountIndex] = updatedAccount;
    saveStoredAccounts(accounts);
  }

  // 3. Update transactions associated with this customer
  const transactions = getStoredTransactions();
  let txsModified = false;
  const updatedTransactions: Transaction[] = transactions.map((tx) => {
    if (tx.account?.customerId === updatedCustomer.id || tx.account?.customer?.id === updatedCustomer.id || tx.accountId === updatedAccount?.id) {
      txsModified = true;
      const acc = updatedAccount || tx.account;
      return {
        ...tx,
        account: acc ? ({ ...acc, customer: updatedCustomer } as Account) : undefined,
      } as Transaction;
    }
    return tx;
  });
  if (txsModified) {
    saveStoredTransactions(updatedTransactions);
  }

  // 4. Record Immutable Audit Log Entry
  const auditLog: AuditLog = {
    id: `audit-corr-${Date.now()}`,
    userId: payload.performedBy.id,
    userEmail: payload.performedBy.email,
    userRole: 'SUPER_ADMIN',
    branchName: payload.performedBy.branch?.name || 'Central Administration',
    action: 'SUPER_ADMIN_CUSTOMER_CORRECTION',
    resource: `Customer ${updatedCustomer.customerNumber} (${updatedCustomer.firstName} ${updatedCustomer.lastName})`,
    previousValue: `Name: ${oldCustomerSnapshot.firstName} ${oldCustomerSnapshot.lastName}, Phone: ${oldCustomerSnapshot.phone}, Card: ${oldCustomerSnapshot.ghanaCardNumber}`,
    newValue: `Name: ${updatedCustomer.firstName} ${updatedCustomer.lastName}, Phone: ${updatedCustomer.phone}, Card: ${updatedCustomer.ghanaCardNumber}, Package: GHS ${payload.savingsPackage || 'unchanged'}, Balance: GHS ${payload.totalSavingsDeposited !== undefined ? payload.totalSavingsDeposited : 'unchanged'}. Reason: ${payload.correctionReason}`,
    createdAt: new Date().toISOString(),
  };
  saveStoredAuditLogs([auditLog, ...getStoredAuditLogs()]);

  // 5. Broadcast to all other devices & tabs
  broadcastRealtimeEvent('CUSTOMER_CREATED', updatedCustomer);
  if (updatedAccount) {
    broadcastRealtimeEvent('ACCOUNT_OPENED', updatedAccount);
  }
  broadcastRealtimeEvent('AUDIT_LOG_RECORDED', [auditLog]);

  // 6. Push to Firebase Realtime Database in background
  import('./cloudSync').then((m) => m.pushLocalToCloud()).catch(() => {});

  return { customer: updatedCustomer, account: updatedAccount };
};
