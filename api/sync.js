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
  updatedAt: new Date().toISOString(),
};

export default function handler(req, res) {
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
    return res.status(200).json({
      success: true,
      vault: globalCloudVault,
      updatedAt: globalCloudVault.updatedAt,
    });
  }

  if (req.method === 'POST') {
    try {
      const incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      // Merge registered users by email
      if (Array.isArray(incoming.registeredUsers) && incoming.registeredUsers.length > 0) {
        const existingUsersMap = new Map();
        (globalCloudVault.registeredUsers || []).forEach(u => existingUsersMap.set(u.email.toLowerCase(), u));
        incoming.registeredUsers.forEach(u => existingUsersMap.set(u.email.toLowerCase(), u));
        globalCloudVault.registeredUsers = Array.from(existingUsersMap.values());
      }

      // Merge customers by id
      if (Array.isArray(incoming.customers)) {
        const custMap = new Map();
        (globalCloudVault.customers || []).forEach(c => custMap.set(c.id, c));
        incoming.customers.forEach(c => custMap.set(c.id, c));
        globalCloudVault.customers = Array.from(custMap.values());
      }

      // Merge accounts by id
      if (Array.isArray(incoming.accounts)) {
        const accMap = new Map();
        (globalCloudVault.accounts || []).forEach(a => accMap.set(a.id, a));
        incoming.accounts.forEach(a => accMap.set(a.id, a));
        globalCloudVault.accounts = Array.from(accMap.values());
      }

      // Merge transactions by id
      if (Array.isArray(incoming.transactions)) {
        const txMap = new Map();
        (globalCloudVault.transactions || []).forEach(t => txMap.set(t.id, t));
        incoming.transactions.forEach(t => txMap.set(t.id, t));
        globalCloudVault.transactions = Array.from(txMap.values());
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
      if (Array.isArray(incoming.approvals)) {
        globalCloudVault.approvals = incoming.approvals;
      }

      globalCloudVault.updatedAt = new Date().toISOString();

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
