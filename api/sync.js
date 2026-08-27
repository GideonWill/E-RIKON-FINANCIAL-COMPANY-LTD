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

const RENDER_BACKEND_SYNC_URL = 'https://e-rikon-ecfms-backend.onrender.com/api/sync';

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
    // If in-memory vault is empty, attempt to pull from Render backend
    if (
      (!globalCloudVault.registeredUsers || globalCloudVault.registeredUsers.length === 0) &&
      (!globalCloudVault.customers || globalCloudVault.customers.length === 0)
    ) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const rRes = await fetch(RENDER_BACKEND_SYNC_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (rRes.ok) {
          const rData = await rRes.json();
          if (rData && rData.vault) {
            globalCloudVault = { ...globalCloudVault, ...rData.vault };
          }
        }
      } catch (e) {
        // Fallback to in-memory vault
      }
    }

    return res.status(200).json({
      success: true,
      vault: globalCloudVault,
      updatedAt: globalCloudVault.updatedAt,
    });
  }

  if (req.method === 'POST') {
    try {
      const incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      // 1. Merge registered users by email & preserve approval elevation
      if (Array.isArray(incoming.registeredUsers) && incoming.registeredUsers.length > 0) {
        const existingUsersMap = new Map();
        (globalCloudVault.registeredUsers || []).forEach(u => existingUsersMap.set(u.email.toLowerCase(), u));
        
        incoming.registeredUsers.forEach(incomingUser => {
          const key = incomingUser.email.toLowerCase();
          const existingUser = existingUsersMap.get(key);
          
          if (existingUser) {
            // Once approved on any device, keep approved status
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

      // 2. Merge approvals by id / targetId & preserve review decisions
      if (Array.isArray(incoming.approvals)) {
        const apprMap = new Map();
        (globalCloudVault.approvals || []).forEach(a => apprMap.set(a.id, a));
        
        incoming.approvals.forEach(incomingAppr => {
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
      }

      // 3. Merge customers by id
      if (Array.isArray(incoming.customers)) {
        const custMap = new Map();
        (globalCloudVault.customers || []).forEach(c => custMap.set(c.id, c));
        incoming.customers.forEach(c => custMap.set(c.id, c));
        globalCloudVault.customers = Array.from(custMap.values());
      }

      // 4. Merge accounts by id
      if (Array.isArray(incoming.accounts)) {
        const accMap = new Map();
        (globalCloudVault.accounts || []).forEach(a => accMap.set(a.id, a));
        incoming.accounts.forEach(a => accMap.set(a.id, a));
        globalCloudVault.accounts = Array.from(accMap.values());
      }

      // 5. Merge transactions by id
      if (Array.isArray(incoming.transactions)) {
        const txMap = new Map();
        (globalCloudVault.transactions || []).forEach(t => txMap.set(t.id, t));
        incoming.transactions.forEach(t => txMap.set(t.id, t));
        globalCloudVault.transactions = Array.from(txMap.values());
      }

      if (Array.isArray(incoming.loans)) {
        const loanMap = new Map();
        (globalCloudVault.loans || []).forEach(l => loanMap.set(l.id, l));
        incoming.loans.forEach(l => loanMap.set(l.id, l));
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

      globalCloudVault.updatedAt = new Date().toISOString();

      // Asynchronously forward to Render backend
      fetch(RENDER_BACKEND_SYNC_URL, {
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
