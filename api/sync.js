// Vercel Serverless Function: Global Multi-Device State Synchronizer
// Handles live real-time state sharing across laptops, phones, and tablets on Vercel

let globalCloudVault = {
  registeredUsers: [],
  customers: [],
  accounts: [],
  transactions: [],
  loans: [],
  companyInterest: [],
  companyWithdrawals: [],
  approvals: [],
  auditLogs: [],
  branches: [],
  updatedAt: new Date().toISOString(),
};

const LIVE_BACKEND_URL = 'https://e-rikon-ecfms-backend.onrender.com/api/sync';

export default async function handler(req, res) {
  // CORS Headers for multi-device access
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const rRes = await fetch(LIVE_BACKEND_URL, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (rRes.ok) {
        const rData = await rRes.json();
        const vault = rData?.vault || rData;
        if (vault && Array.isArray(vault.registeredUsers)) {
          globalCloudVault = { ...globalCloudVault, ...vault };
          return res.status(200).json({
            success: true,
            vault: globalCloudVault,
            updatedAt: globalCloudVault.updatedAt || new Date().toISOString(),
          });
        }
      }
    } catch {}

    return res.status(200).json({
      success: true,
      vault: globalCloudVault,
      updatedAt: globalCloudVault.updatedAt,
    });
  }

  if (req.method === 'POST') {
    try {
      const incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const deletedUserEmails = Array.isArray(incoming.deletedUserEmails) ? incoming.deletedUserEmails.map(e => (e || '').toLowerCase()) : [];

      // 0. Authoritative Reset / Fresh Slate handling
      if (incoming.authoritative || incoming.action === 'CLEAR_FINANCIALS' || incoming.isReset) {
        globalCloudVault.customers = Array.isArray(incoming.customers) ? incoming.customers : [];
        globalCloudVault.accounts = Array.isArray(incoming.accounts) ? incoming.accounts : [];
        globalCloudVault.transactions = Array.isArray(incoming.transactions) ? incoming.transactions : [];
        globalCloudVault.loans = Array.isArray(incoming.loans) ? incoming.loans : [];
        globalCloudVault.companyInterest = Array.isArray(incoming.companyInterest) ? incoming.companyInterest : [];
        globalCloudVault.companyWithdrawals = Array.isArray(incoming.companyWithdrawals) ? incoming.companyWithdrawals : [];
        globalCloudVault.auditLogs = Array.isArray(incoming.auditLogs) ? incoming.auditLogs : [];
        globalCloudVault.deletedCustomerIds = [];
        if (Array.isArray(globalCloudVault.approvals)) {
          globalCloudVault.approvals = globalCloudVault.approvals.filter(a => a.type === 'STAFF_ROLE_SIGNUP');
        }
      }

      // 1. Merge registered staff accounts
      if (Array.isArray(incoming.registeredUsers)) {
        const existingUsersMap = new Map();
        (globalCloudVault.registeredUsers || []).forEach(u => {
          if (u.email) existingUsersMap.set(u.email.toLowerCase(), u);
        });

        incoming.registeredUsers.forEach(incomingUser => {
          if (!incomingUser.email) return;
          const key = incomingUser.email.toLowerCase();
          const existingUser = existingUsersMap.get(key);

          if (existingUser) {
            const isApproved = Boolean(existingUser.isApproved || incomingUser.isApproved || incomingUser.role === 'SUPER_ADMIN');
            existingUsersMap.set(key, {
              ...existingUser,
              ...incomingUser,
              isApproved,
              status: isApproved ? 'ACTIVE' : (existingUser.status === 'ACTIVE' ? 'ACTIVE' : incomingUser.status || 'PENDING_APPROVAL'),
            });
          } else {
            existingUsersMap.set(key, incomingUser);
          }
        });

        globalCloudVault.registeredUsers = Array.from(existingUsersMap.values());
      }

      // 2. Merge approvals & apply deletions
      if (Array.isArray(incoming.approvals)) {
        const apprMap = new Map();
        (globalCloudVault.approvals || []).forEach(a => {
          const email = a.details?.email?.toLowerCase();
          if (!deletedUserEmails.includes(email) && !deletedUserEmails.includes(a.targetId)) {
            apprMap.set(a.id, a);
          }
        });

        incoming.approvals.forEach(incomingAppr => {
          const email = incomingAppr.details?.email?.toLowerCase();
          if (deletedUserEmails.includes(email) || deletedUserEmails.includes(incomingAppr.targetId)) return;
          const existingAppr = apprMap.get(incomingAppr.id);
          if (existingAppr) {
            if (existingAppr.status === 'APPROVED' || existingAppr.status === 'REJECTED') {
              apprMap.set(incomingAppr.id, existingAppr);
            } else {
              apprMap.set(incomingAppr.id, incomingAppr);
            }
          } else {
            apprMap.set(incomingAppr.id, incomingAppr);
          }
        });

        globalCloudVault.approvals = Array.from(apprMap.values());
      } else if (deletedUserEmails.length > 0) {
        globalCloudVault.approvals = (globalCloudVault.approvals || []).filter(
          a => !deletedUserEmails.includes(a.details?.email?.toLowerCase()) && !deletedUserEmails.includes(a.targetId)
        );
      }

      // Accumulate deletedCustomerIds and deletedUserEmails
      const incomingDelCust = Array.isArray(incoming.deletedCustomerIds) ? incoming.deletedCustomerIds : [];
      const currentDelCust = new Set(globalCloudVault.deletedCustomerIds || []);
      incomingDelCust.forEach(id => { if (id) currentDelCust.add(id); });
      globalCloudVault.deletedCustomerIds = Array.from(currentDelCust);
      const deletedCustIds = globalCloudVault.deletedCustomerIds;

      if (Array.isArray(incoming.deletedUserEmails)) {
        const currentDelUsers = new Set((globalCloudVault.deletedUserEmails || []).map(e => e.toLowerCase()));
        incoming.deletedUserEmails.forEach(e => { if (e) currentDelUsers.add(e.toLowerCase()); });
        globalCloudVault.deletedUserEmails = Array.from(currentDelUsers);
      }

      if (!incoming.authoritative) {
        // 3. Merge customers & apply deletions
        if (Array.isArray(incoming.customers)) {
          const custMap = new Map();
          (globalCloudVault.customers || []).forEach(c => {
            if (!deletedCustIds.includes(c.id) && !deletedCustIds.includes(c.customerNumber)) custMap.set(c.id, c);
          });
          incoming.customers.forEach(c => {
            if (!deletedCustIds.includes(c.id) && !deletedCustIds.includes(c.customerNumber)) custMap.set(c.id, c);
          });
          globalCloudVault.customers = Array.from(custMap.values());
        } else if (deletedCustIds.length > 0) {
          globalCloudVault.customers = (globalCloudVault.customers || []).filter(c => !deletedCustIds.includes(c.id) && !deletedCustIds.includes(c.customerNumber));
        }

        // 4. Merge accounts & apply deletions
        if (Array.isArray(incoming.accounts)) {
          const accMap = new Map();
          (globalCloudVault.accounts || []).forEach(a => {
            if (!deletedCustIds.includes(a.customerId) && !deletedCustIds.includes(a.id) && !deletedCustIds.includes(a.customer?.id)) accMap.set(a.id, a);
          });
          incoming.accounts.forEach(a => {
            if (!deletedCustIds.includes(a.customerId) && !deletedCustIds.includes(a.id) && !deletedCustIds.includes(a.customer?.id)) accMap.set(a.id, a);
          });
          globalCloudVault.accounts = Array.from(accMap.values());
        } else if (deletedCustIds.length > 0) {
          globalCloudVault.accounts = (globalCloudVault.accounts || []).filter(a => !deletedCustIds.includes(a.customerId) && !deletedCustIds.includes(a.id) && !deletedCustIds.includes(a.customer?.id));
        }

        // 5. Merge transactions & apply deletions
        if (Array.isArray(incoming.transactions)) {
          const txMap = new Map();
          (globalCloudVault.transactions || []).forEach(t => {
            const cId = t.customerId || t.account?.customerId || t.account?.customer?.id;
            if (!deletedCustIds.includes(t.id) && (!cId || !deletedCustIds.includes(cId))) txMap.set(t.id, t);
          });
          incoming.transactions.forEach(t => {
            const cId = t.customerId || t.account?.customerId || t.account?.customer?.id;
            if (!deletedCustIds.includes(t.id) && (!cId || !deletedCustIds.includes(cId))) txMap.set(t.id, t);
          });
          globalCloudVault.transactions = Array.from(txMap.values());
        } else if (deletedCustIds.length > 0) {
          globalCloudVault.transactions = (globalCloudVault.transactions || []).filter(t => {
            const cId = t.customerId || t.account?.customerId || t.account?.customer?.id;
            return !deletedCustIds.includes(t.id) && (!cId || !deletedCustIds.includes(cId));
          });
        }

      if (Array.isArray(incoming.loans)) {
        const loanMap = new Map();
        (globalCloudVault.loans || []).forEach(l => {
          if (!deletedCustIds.includes(l.customerId)) loanMap.set(l.id, l);
        });
        incoming.loans.forEach(l => {
          if (!deletedCustIds.includes(l.customerId)) loanMap.set(l.id, l);
        });
        globalCloudVault.loans = Array.from(loanMap.values());
      }

      if (Array.isArray(incoming.companyInterest)) {
        const intMap = new Map();
        (globalCloudVault.companyInterest || []).forEach(i => intMap.set(i.id, i));
        incoming.companyInterest.forEach(i => intMap.set(i.id, i));
        globalCloudVault.companyInterest = Array.from(intMap.values());
      }

      if (Array.isArray(incoming.companyWithdrawals)) {
        const wdMap = new Map();
        (globalCloudVault.companyWithdrawals || []).forEach(w => wdMap.set(w.id, w));
        incoming.companyWithdrawals.forEach(w => wdMap.set(w.id, w));
        globalCloudVault.companyWithdrawals = Array.from(wdMap.values());
      }

      if (Array.isArray(incoming.auditLogs)) {
        const logMap = new Map();
        (globalCloudVault.auditLogs || []).forEach(l => logMap.set(l.id, l));
        incoming.auditLogs.forEach(l => logMap.set(l.id, l));
        globalCloudVault.auditLogs = Array.from(logMap.values());
      }

      if (Array.isArray(incoming.branches)) {
        globalCloudVault.branches = incoming.branches;
      }
      }

      globalCloudVault.updatedAt = new Date().toISOString();

      // Asynchronously forward to live database backend
      fetch(LIVE_BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalCloudVault),
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Cloud vault updated successfully',
        vault: globalCloudVault,
        updatedAt: globalCloudVault.updatedAt,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload: ' + (err?.message || err),
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
