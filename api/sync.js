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

      // 3. Merge / Sync Customers
      if (Array.isArray(incoming.customers)) {
        globalCloudVault.customers = incoming.customers;
      }

      // 4. Merge / Sync Transactions
      if (Array.isArray(incoming.transactions)) {
        globalCloudVault.transactions = incoming.transactions;
      }

      // 5. Merge / Sync Accounts
      if (Array.isArray(incoming.accounts)) {
        globalCloudVault.accounts = incoming.accounts;
      }

      if (Array.isArray(incoming.loans)) {
        globalCloudVault.loans = incoming.loans;
      }

      if (Array.isArray(incoming.companyInterest)) {
        globalCloudVault.companyInterest = incoming.companyInterest;
      }

      if (Array.isArray(incoming.companyWithdrawals)) {
        globalCloudVault.companyWithdrawals = incoming.companyWithdrawals;
      }

      if (Array.isArray(incoming.auditLogs)) {
        globalCloudVault.auditLogs = incoming.auditLogs;
      }

      if (Array.isArray(incoming.branches)) {
        globalCloudVault.branches = incoming.branches;
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
