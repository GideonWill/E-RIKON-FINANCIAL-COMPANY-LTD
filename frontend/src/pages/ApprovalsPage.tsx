import React, { useState, useEffect } from 'react';
import { 
  getStoredApprovals, 
  saveStoredApprovals, 
  approveRequest, 
  rejectRequest,
  getRegisteredUsers,
  saveRegisteredUsers,
  deleteRegisteredUser,
  removeDeletedUserEmail,
  blockUserAccount,
  unblockUserAccount,
  isUserBlocked,
  apiClient
} from '../services/api';
import { useRealtimeSync, broadcastRealtimeEvent } from '../services/realtimeSync';
import { pushLocalToCloud, pullCloudToLocal } from '../services/cloudSync';
import { ApprovalRequest, ApprovalType, RoleName, RegisteredUserRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  UserCheck, 
  PiggyBank, 
  Calculator, 
  AlertTriangle, 
  Search, 
  Filter, 
  FileText,
  Lock,
  Sparkles,
  ArrowUpRight,
  Users,
  Building2,
  Mail,
  Smartphone,
  CreditCard,
  BadgeAlert,
  UserX,
  UserPlus,
  Trash2,
  RotateCw,
  Ban,
  ShieldAlert
} from 'lucide-react';

export const ApprovalsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(getStoredApprovals());
  const [registeredUsers, setRegisteredUsers] = useState(getRegisteredUsers());
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [viewMode, setViewMode] = useState<'CLEARANCE_QUEUE' | 'STAFF_DIRECTORY'>('CLEARANCE_QUEUE');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [userToDelete, setUserToDelete] = useState<RegisteredUserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [userToBlock, setUserToBlock] = useState<RegisteredUserRecord | null>(null);
  const [blockReason, setBlockReason] = useState<string>('Administrative Suspension by Super Administrator');
  const [isBlocking, setIsBlocking] = useState<boolean>(false);

  // Sync pending staff accounts and all registered users from cloud relay & backend
  const syncPendingFromBackend = async () => {
    // 1. Pull latest cross-device cloud vault state
    await pullCloudToLocal().catch(() => {});

    // 2. Fetch latest registered staff from backend API
    try {
      let usersData: any[] = [];
      try {
        const { data } = await apiClient.get('/auth/users');
        if (Array.isArray(data)) usersData = data;
      } catch {
        const directRes = await fetch('https://e-rikon-ecfms-backend.onrender.com/api/auth/users').catch(() => null);
        if (directRes && directRes.ok) {
          const directData = await directRes.json();
          if (Array.isArray(directData)) usersData = directData;
        }
      }

      if (usersData.length > 0) {
        const localUsers = getRegisteredUsers();
        const userMap = new Map<string, RegisteredUserRecord>();
        localUsers.forEach((u) => userMap.set(u.email.toLowerCase(), u));

        usersData.forEach((u: any) => {
          removeDeletedUserEmail(u.email);
          if (u.id) removeDeletedUserEmail(u.id);

          const key = u.email.toLowerCase();
          const existing = userMap.get(key);
          const isApproved = Boolean(existing?.isApproved || u.isApproved || u.role === 'SUPER_ADMIN');
          userMap.set(key, {
            id: u.id || existing?.id || `user-${Date.now()}`,
            employeeId: u.employeeId || existing?.employeeId || `EMP-${Date.now().toString().slice(-4)}`,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone || existing?.phone || '—',
            role: u.role,
            ghanaCard: u.ghanaCard || existing?.ghanaCard || '—',
            branchId: u.branchId || existing?.branchId || 'br-01',
            branch: u.branch || existing?.branch || { id: 'br-01', name: 'Accra Central Main Branch' } as any,
            isApproved,
            createdAt: u.createdAt || existing?.createdAt || new Date().toISOString(),
            status: isApproved ? 'ACTIVE' : (existing?.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_APPROVAL'),
          });
        });

        const mergedUsers = Array.from(userMap.values());
        saveRegisteredUsers(mergedUsers);
        setRegisteredUsers(mergedUsers);
        pushLocalToCloud().catch(() => {});
      } else {
        setRegisteredUsers(getRegisteredUsers());
      }
    } catch {
      setRegisteredUsers(getRegisteredUsers());
    }

    // 3. Ensure all pending staff users have active approval tickets in the Clearance Queue
    try {
      const currentUsers = getRegisteredUsers();
      const localApprovals = getStoredApprovals();
      const apprMap = new Map<string, ApprovalRequest>();
      localApprovals.forEach((a) => apprMap.set(a.id, a));

      // Also incorporate backend pending queue if reachable
      try {
        const { data } = await apiClient.get('/auth/pending');
        if (Array.isArray(data)) {
          data.forEach((u: any) => {
            const userKey = u.email?.toLowerCase();
            const localUser = currentUsers.find((cu) => cu.email?.toLowerCase() === userKey || cu.id === u.id);
            // If already approved, skip pending ticket
            if (localUser && (localUser.isApproved || localUser.role === 'SUPER_ADMIN')) return;

            const matchingAppr = Array.from(apprMap.values()).find(
              (a) => a.targetId === u.id || a.details?.email?.toLowerCase() === userKey
            );
            if (matchingAppr && matchingAppr.status === 'APPROVED') return;

            const appId = `appr-${u.id}`;
            if (!apprMap.has(appId)) {
              apprMap.set(appId, {
                id: appId,
                type: 'STAFF_ROLE_SIGNUP',
                title: `New ${u.role?.replace(/_/g, ' ')} Registration: ${u.firstName} ${u.lastName}`,
                description: `Application received for ${u.role?.replace(/_/g, ' ')} position. Contact: ${u.phone || 'N/A'} | Ghana Card: ${u.ghanaCard || 'N/A'}`,
                targetId: u.id,
                requestedById: u.id,
                requestedByName: `${u.firstName} ${u.lastName}`,
                requestedRole: u.role,
                details: {
                  email: u.email,
                  phone: u.phone,
                  ghanaCard: u.ghanaCard,
                  role: u.role,
                },
                status: 'PENDING',
                createdAt: u.createdAt || new Date().toISOString(),
              });
            }
          });
        }
      } catch {}

      // Cross-check all registered users
      currentUsers.forEach((user) => {
        if (!user.isApproved && user.role !== 'SUPER_ADMIN') {
          const userKey = user.email?.toLowerCase();
          const matchingAppr = Array.from(apprMap.values()).find(
            (a) => a.targetId === user.id || a.details?.email?.toLowerCase() === userKey
          );
          if (matchingAppr && matchingAppr.status === 'APPROVED') return;

          if (!matchingAppr) {
            const newAppId = `appr-${user.id}`;
            apprMap.set(newAppId, {
              id: newAppId,
              type: 'STAFF_ROLE_SIGNUP',
              title: `New ${user.role.replace(/_/g, ' ')} Registration: ${user.firstName} ${user.lastName}`,
              description: `Application received for ${user.role.replace(/_/g, ' ')} position. Contact: ${user.phone || 'N/A'} | Ghana Card: ${user.ghanaCard || 'N/A'}`,
              targetId: user.id,
              requestedById: user.id,
              requestedByName: `${user.firstName} ${user.lastName}`,
              requestedRole: user.role,
              details: {
                email: user.email,
                phone: user.phone,
                ghanaCard: user.ghanaCard,
                role: user.role,
              },
              status: 'PENDING',
              createdAt: user.createdAt || new Date().toISOString(),
            });
          }
        }
      });

      const finalApprovals = Array.from(apprMap.values());
      saveStoredApprovals(finalApprovals);
      setApprovals(finalApprovals);
    } catch {
      setApprovals(getStoredApprovals());
    }
  };

  useEffect(() => {
    syncPendingFromBackend();
  }, []);

  // Real-time multi-device subscription
  useRealtimeSync(() => {
    setApprovals(getStoredApprovals());
    setRegisteredUsers(getRegisteredUsers());
  });
  
  // Selected Action Modal
  const [selectedItemForAction, setSelectedItemForAction] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [actionRemarks, setActionRemarks] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;
  const approvedCount = approvals.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = approvals.filter((a) => a.status === 'REJECTED').length;

  const handleOpenActionModal = (item: ApprovalRequest, type: 'APPROVE' | 'REJECT') => {
    if (!isSuperAdmin) {
      alert('Security Clearance Violation: ONLY the Super Admin can make or reject approvals.');
      return;
    }
    setSelectedItemForAction(item);
    setActionType(type);
    setActionRemarks(type === 'APPROVE' ? 'Approved by Super Admin' : 'Declined per executive review');
  };

  const handleConfirmAction = () => {
    if (!selectedItemForAction || !currentUser || !isSuperAdmin) return;

    try {
      if (actionType === 'APPROVE') {
        approveRequest(selectedItemForAction.id, currentUser, actionRemarks);
        setFeedbackMsg(`✅ Request #${selectedItemForAction.id.slice(-6)} successfully APPROVED by Super Admin.`);
      } else {
        rejectRequest(selectedItemForAction.id, currentUser, actionRemarks);
        setFeedbackMsg(`❌ Request #${selectedItemForAction.id.slice(-6)} REJECTED by Super Admin.`);
      }

      setApprovals(getStoredApprovals());
      setRegisteredUsers(getRegisteredUsers());
      setSelectedItemForAction(null);
      pushLocalToCloud().catch(() => {});

      setTimeout(() => {
        setFeedbackMsg(null);
      }, 4000);
    } catch (err: any) {
      alert(err.message || 'Error processing approval');
    }
  };

  // Direct Staff Approval toggle
  const handleToggleStaffApproval = (userId: string, targetStatus: boolean) => {
    if (!isSuperAdmin || !currentUser) return;
    const users = getRegisteredUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      const targetEmail = (users[idx].email || '').trim().toLowerCase();
      users[idx].isApproved = targetStatus;
      users[idx].status = targetStatus ? 'ACTIVE' : 'PENDING_APPROVAL';
      saveRegisteredUsers(users);
      setRegisteredUsers(users);

      // Also update any matching pending approval items
      const apprs = getStoredApprovals();
      apprs.forEach((a) => {
        if (a.targetId === userId || (targetEmail && a.details?.email?.toLowerCase() === targetEmail)) {
          a.status = targetStatus ? 'APPROVED' : 'REJECTED';
          a.reviewedByName = `${currentUser.firstName} ${currentUser.lastName}`;
          a.reviewedAt = new Date().toISOString();
        }
      });
      saveStoredApprovals(apprs);
      setApprovals(apprs);

      // Broadcast real-time approval decision
      broadcastRealtimeEvent('APPROVAL_DECISION_MADE', {
        userId,
        email: targetEmail,
        action: targetStatus ? 'APPROVED' : 'REJECTED',
        role: users[idx].role,
        name: `${users[idx].firstName} ${users[idx].lastName}`,
      });

      // Sync to live backend
      if (targetStatus) {
        apiClient.patch(`/auth/approve/${userId}`).catch(() => {});
        if (targetEmail) apiClient.patch(`/auth/approve/${targetEmail}`).catch(() => {});
      } else {
        apiClient.delete(`/auth/reject/${userId}`).catch(() => {});
        if (targetEmail) apiClient.delete(`/auth/reject/${targetEmail}`).catch(() => {});
      }

      pushLocalToCloud().catch(() => {});

      setFeedbackMsg(`✅ Clearance for ${users[idx].firstName} ${users[idx].lastName} (${users[idx].role}) updated to ${targetStatus ? 'ACTIVE (APPROVED)' : 'PENDING'}.`);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Permanent Delete User by Super Admin
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete || !currentUser || !isSuperAdmin) return;
    setIsDeleting(true);
    try {
      await deleteRegisteredUser(userToDelete.id, currentUser);
      setRegisteredUsers(getRegisteredUsers());
      setApprovals(getStoredApprovals());
      setFeedbackMsg(`🗑️ User account ${userToDelete.firstName} ${userToDelete.lastName} (${userToDelete.email}) permanently deleted by Super Admin.`);
      setUserToDelete(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Block User Workstation Access by Super Admin
  const handleConfirmBlockUser = async () => {
    if (!userToBlock || !currentUser || !isSuperAdmin) return;
    setIsBlocking(true);
    try {
      await blockUserAccount(userToBlock.id, currentUser, blockReason);
      setRegisteredUsers(getRegisteredUsers());
      setFeedbackMsg(`⛔ User ${userToBlock.firstName} ${userToBlock.lastName} (${userToBlock.role}) access BLOCKED successfully.`);
      setUserToBlock(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to block user.');
    } finally {
      setIsBlocking(false);
    }
  };

  // Unblock User Workstation Access by Super Admin
  const handleUnblockUser = async (staff: RegisteredUserRecord) => {
    if (!currentUser || !isSuperAdmin) return;
    try {
      await unblockUserAccount(staff.id, currentUser);
      setRegisteredUsers(getRegisteredUsers());
      setFeedbackMsg(`✅ User ${staff.firstName} ${staff.lastName} (${staff.role}) access UNBLOCKED & RESTORED.`);
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to unblock user.');
    }
  };

  const filteredApprovals = approvals.filter((item) => {
    const matchesFilter = selectedFilter === 'ALL' || item.type === selectedFilter || item.status === selectedFilter;
    const rawSearch = searchQuery.trim().toLowerCase();
    if (!rawSearch) return matchesFilter;

    const title = (item.title || '').toLowerCase();
    const reqName = (item.requestedByName || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const cleanSearch = rawSearch.replace(/\s+/g, ' ');

    const directMatch =
      title.includes(cleanSearch) ||
      reqName.includes(cleanSearch) ||
      desc.includes(cleanSearch);

    const searchTokens = cleanSearch.split(' ').filter(Boolean);
    const tokensMatch = searchTokens.every(
      (tok) => title.includes(tok) || reqName.includes(tok) || desc.includes(tok)
    );

    return matchesFilter && (directMatch || tokensMatch);
  });

  const filteredRegisteredStaff = registeredUsers.filter((user) => {
    const rawSearch = searchQuery.trim().toLowerCase();
    const matchesFilter = selectedFilter === 'ALL' || user.role === selectedFilter || user.status === selectedFilter;
    if (!rawSearch) return matchesFilter;

    const firstName = (user.firstName || '').toLowerCase();
    const lastName = (user.lastName || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    const revFullName = `${lastName} ${firstName}`.trim();
    const email = (user.email || '').toLowerCase();
    const role = (user.role || '').toLowerCase();
    const phone = (user.phone || '').replace(/\s+/g, '');
    const ghanaCard = (user.ghanaCard || '').toLowerCase();
    const ghanaCardNoHyphen = ghanaCard.replace(/-/g, '');
    const cleanSearch = rawSearch.replace(/\s+/g, ' ');
    const cleanSearchNoHyphen = cleanSearch.replace(/-/g, '');

    const directMatch =
      fullName.includes(cleanSearch) ||
      revFullName.includes(cleanSearch) ||
      firstName.includes(cleanSearch) ||
      lastName.includes(cleanSearch) ||
      email.includes(cleanSearch) ||
      role.includes(cleanSearch) ||
      ghanaCard.includes(cleanSearch) ||
      ghanaCardNoHyphen.includes(cleanSearchNoHyphen) ||
      phone.includes(cleanSearch.replace(/\s+/g, ''));

    const searchTokens = cleanSearch.split(' ').filter(Boolean);
    const tokensMatch = searchTokens.every(
      (tok) =>
        fullName.includes(tok) ||
        email.includes(tok) ||
        role.includes(tok) ||
        ghanaCard.includes(tok) ||
        ghanaCardNoHyphen.includes(tok.replace(/-/g, '')) ||
        phone.includes(tok)
    );

    return matchesFilter && (directMatch || tokensMatch);
  });

  const getTypeBadge = (type: ApprovalType) => {
    switch (type) {
      case 'STAFF_ROLE_SIGNUP':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-50 text-[#0d9488] border border-teal-200">
            Staff Signup
          </span>
        );
      case 'COMPANY_INTEREST_WITHDRAWAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            Interest Vault
          </span>
        );
      case 'LOAN_APPROVAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            Loan Credit
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            Operation
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Approved / Active</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            <span>Declined</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 animate-pulse">
            <Clock className="w-3 h-3" />
            <span>Pending Clearance</span>
          </span>
        );
    }
  };

  const handleManualCloudSync = async () => {
    setIsSyncingLive(true);
    try {
      await pushLocalToCloud();
      await pullCloudToLocal();
      await syncPendingFromBackend();
      setRegisteredUsers(getRegisteredUsers());
      setApprovals(getStoredApprovals());
      setFeedbackMsg('✅ Live Cloud State Synced Successfully Across All Devices!');
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch {
      setFeedbackMsg('⚠️ Cloud Sync Encountered a Warning, Retrying Automatically in Background.');
      setTimeout(() => setFeedbackMsg(null), 3000);
    } finally {
      setIsSyncingLive(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/60 flex items-center justify-center text-[#0d9488] shadow-xs shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Super Admin Approvals Hub & Staff Directory
            </h2>
            <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
              <span>Executive Clearance Hub</span>
              <span>•</span>
              <span>View All Signed-Up Users, Authorize Workstation Roles & Approve Financial Payouts</span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs & Live Cloud Sync Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleManualCloudSync}
            disabled={isSyncingLive}
            className="px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 bg-[#0a3866] hover:bg-[#082d52] text-white shadow-xs border border-[#0e4b85]"
            title="Force instant bi-directional cloud synchronization across phone and desktop"
          >
            <RotateCw className={`w-3.5 h-3.5 text-teal-400 ${isSyncingLive ? 'animate-spin' : ''}`} />
            <span>{isSyncingLive ? 'Syncing Cloud...' : 'Sync Cloud'}</span>
          </button>

          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setViewMode('CLEARANCE_QUEUE'); setSelectedFilter('ALL'); }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'CLEARANCE_QUEUE'
                  ? 'bg-white dark:bg-slate-900 text-[#0d9488] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Clearance Queue ({pendingCount})</span>
            </button>

            <button
              type="button"
              onClick={() => { setViewMode('STAFF_DIRECTORY'); setSelectedFilter('ALL'); }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'STAFF_DIRECTORY'
                  ? 'bg-white dark:bg-slate-900 text-[#0d9488] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>All Signed-Up Users ({registeredUsers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-white font-mono cursor-pointer">✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Signed-Up Staff</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{registeredUsers.length}</div>
          <span className="text-[10px] text-slate-500 font-medium">Registered User Accounts in System</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Pending Approvals</span>
          <div className="text-2xl font-black text-amber-500 font-mono">{pendingCount}</div>
          <span className="text-[10px] text-amber-600 font-medium">Awaiting Super Admin Decision</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Active Approved Staff</span>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {registeredUsers.filter((u) => u.isApproved || u.status === 'ACTIVE').length}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">Cleared for Workstation Operations</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Approved Decisions</span>
          <div className="text-2xl font-black text-[#0d9488] font-mono">{approvedCount}</div>
          <span className="text-[10px] text-teal-600 font-medium">Executive Clearances Granted</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={viewMode === 'CLEARANCE_QUEUE' ? "Search clearance requests by name, title, or details..." : "Search registered staff by name, email, phone, role, Ghana Card..."}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {viewMode === 'CLEARANCE_QUEUE' ? (
              <>
                <option value="PENDING">Pending Only</option>
                <option value="APPROVED">Approved Only</option>
                <option value="REJECTED">Declined Only</option>
                <option value="STAFF_ROLE_SIGNUP">Staff Signups</option>
                <option value="COMPANY_INTEREST_WITHDRAWAL">Company Interest</option>
                <option value="LOAN_APPROVAL">Loan Approvals</option>
              </>
            ) : (
              <>
                <option value="PENDING_APPROVAL">Pending Clearance</option>
                <option value="ACTIVE">Active Staff</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Operations Admin</option>
                <option value="BRANCH_ADMIN">Branch Admin</option>
                <option value="TELLER">Tellers</option>
                <option value="FIELD_OFFICER">Field Officers</option>
                <option value="LOAN_OFFICER">Loan Officers</option>
                <option value="AUDITOR">Auditors</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* ================= VIEW 1: CLEARANCE QUEUE ================= */}
      {viewMode === 'CLEARANCE_QUEUE' && (
        <div className="space-y-3">
          {filteredApprovals.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Clearance Queue Is Clear</h3>
              <p className="text-xs text-slate-500">No approval requests match your search filter.</p>
            </div>
          ) : (
            filteredApprovals.map((item) => {
              const isPending = item.status === 'PENDING';
              return (
                <div 
                  key={item.id}
                  className={`p-5 rounded-3xl border transition-all space-y-3.5 shadow-2xs ${
                    isPending 
                      ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-900/50 hover:border-amber-400' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      {getTypeBadge(item.type)}
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">{item.title}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(item.status)}
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB') : '—'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Details Card */}
                  {item.details && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 font-mono text-xs border border-slate-100 dark:border-slate-800">
                      {Object.entries(item.details).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-[10px] uppercase text-slate-400 block">{k}</span>
                          <span className="font-bold truncate block">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs text-slate-400">
                      Submitted by: <span className="font-bold text-slate-700 dark:text-slate-200">{item.requestedByName}</span> ({item.requestedRole})
                      {item.reviewedByName && (
                        <span className="ml-2 text-emerald-600 font-bold">
                          • Reviewed by Super Admin: {item.reviewedByName}
                        </span>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex items-center space-x-2">
                        {isSuperAdmin ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenActionModal(item, 'REJECT')}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenActionModal(item, 'APPROVE')}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#0d9488] to-[#166534] hover:opacity-95 text-white font-black text-xs transition-all shadow-md shadow-teal-900/10 cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve Request</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-500 italic">
                            Clearance restricted to Super Admin
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ================= VIEW 2: ALL REGISTERED STAFF DIRECTORY ================= */}
      {viewMode === 'STAFF_DIRECTORY' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0d9488]" />
                Institutional Staff & Signed-Up Users Directory
              </h3>
              <p className="text-xs text-slate-500">
                Complete roster of all personnel accounts created in the system with their clearance levels and contact info.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#0d9488]">
              Total Personnel: {filteredRegisteredStaff.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-3 px-3">Staff Member</th>
                  <th className="py-3 px-3">Role / Workstation</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Phone Number</th>
                  <th className="py-3 px-3">Ghana Card PIN</th>
                  <th className="py-3 px-3">Branch</th>
                  <th className="py-3 px-3">Status</th>
                  {isSuperAdmin && <th className="py-3 px-3 text-center">Executive Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {filteredRegisteredStaff.length > 0 ? (
                  filteredRegisteredStaff.map((staff) => {
                    const isApproved = staff.isApproved || staff.status === 'ACTIVE';
                    const isSuperAdminRole = staff.role === 'SUPER_ADMIN';

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0a3866] via-[#0d9488] to-[#166534] flex items-center justify-center text-white text-xs font-black shadow-xs">
                              {staff.firstName[0]}{staff.lastName[0]}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white font-sans text-xs flex items-center gap-1">
                                {staff.firstName} {staff.lastName}
                                {isSuperAdminRole && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">{staff.employeeId || 'STAFF'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isSuperAdminRole 
                              ? 'bg-[#0a3866] text-white border border-[#0e4b85]' 
                              : 'bg-teal-50 dark:bg-teal-950/40 text-[#0d9488] border border-teal-200'
                          }`}>
                            {staff.role.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-sans text-slate-700 dark:text-slate-300">
                          {staff.email}
                        </td>

                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                          {staff.phone || '—'}
                        </td>

                        <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                          {staff.ghanaCard || '—'}
                        </td>

                        <td className="py-3 px-3 font-sans text-slate-600 dark:text-slate-300">
                          {staff.branch?.name || 'Accra Central Main'}
                        </td>

                        <td className="py-3 px-3">
                          {isUserBlocked(staff) ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/30 flex items-center gap-1 w-fit shadow-xs">
                              <Ban className="w-3 h-3 text-rose-500" />
                              BLOCKED
                            </span>
                          ) : (
                            getStatusBadge(isApproved ? 'ACTIVE' : 'PENDING_APPROVAL')
                          )}
                        </td>

                        {isSuperAdmin && (
                          <td className="py-3 px-3 text-center">
                            {staff.id === currentUser?.id || staff.email?.toLowerCase() === currentUser?.email?.toLowerCase() ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-sans italic bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                You (Super Admin)
                              </span>
                            ) : (
                              <div className="flex items-center justify-center space-x-1.5">
                                {/* Block / Unblock Toggle Button (Super Admin Exclusive) */}
                                {isUserBlocked(staff) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUnblockUser(staff)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                    title="Unblock user and restore workstation access"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Unblock</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUserToBlock(staff);
                                      setBlockReason('Administrative Suspension by Super Administrator');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                    title="Block user from accessing any workstation page"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>Block</span>
                                  </button>
                                )}

                                {!isSuperAdminRole && !isUserBlocked(staff) && (
                                  isApproved ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStaffApproval(staff.id, false)}
                                      className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-[10px] transition-all cursor-pointer inline-flex items-center gap-1"
                                      title="Revoke access clearance"
                                    >
                                      <UserX className="w-3 h-3" />
                                      <span>Revoke</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStaffApproval(staff.id, true)}
                                      className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[10px] transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                      title="Grant immediate clearance"
                                    >
                                      <UserCheck className="w-3 h-3" />
                                      <span>Approve</span>
                                    </button>
                                  )
                                )}

                                <button
                                  type="button"
                                  onClick={() => setUserToDelete(staff)}
                                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-rose-600 border border-slate-200 dark:border-slate-700 font-bold text-[10px] transition-all cursor-pointer inline-flex items-center gap-1"
                                  title="Permanently delete user from system"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No signed-up users found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Super Admin Action Confirmation Modal */}
      {selectedItemForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-white space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-400">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-extrabold text-base text-white">
                  Super Admin Executive Decision
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemForAction(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Target Request</span>
                <div className="font-bold text-white text-sm">{selectedItemForAction.title}</div>
                <div className="text-slate-400 font-mono">Requester: {selectedItemForAction.requestedByName}</div>
              </div>

              <div>
                <label className="font-bold text-slate-200">Super Admin Review Remarks *</label>
                <textarea
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  rows={3}
                  placeholder="Enter executive review remarks..."
                  style={{ color: '#ffffff', backgroundColor: '#020617' }}
                  className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-400 text-xs font-medium focus:ring-2 focus:ring-emerald-500/50 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedItemForAction(null)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAction}
                className={`w-1/2 py-2.5 rounded-xl font-extrabold text-xs shadow-lg cursor-pointer ${
                  actionType === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                }`}
              >
                {actionType === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Super Admin Permanent User Deletion Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-rose-900/60 shadow-2xl text-white space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-500">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-extrabold text-base text-white">
                  Permanently Delete User Account
                </h3>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-900/50 space-y-1">
                <div className="text-rose-300 font-bold">⚠️ Warning: Irreversible Super Admin Action</div>
                <div className="text-slate-300 text-[11px]">
                  You are about to permanently remove this user account from E-RiKON ECFMS:
                </div>
                <div className="pt-2 font-mono text-xs text-white">
                  <div><strong>Name:</strong> {userToDelete.firstName} {userToDelete.lastName}</div>
                  <div><strong>Email:</strong> {userToDelete.email}</div>
                  <div><strong>Role:</strong> {userToDelete.role}</div>
                  <div><strong>Ghana Card:</strong> {userToDelete.ghanaCard || 'N/A'}</div>
                </div>
              </div>

              <p className="text-slate-400 text-[11px] leading-relaxed">
                Once deleted, this user will no longer be able to log in to any workstation. All associated pending approvals will be purged and an immutable audit log entry will be recorded.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeleting}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Super Admin Block User Workstation Access Modal */}
      {userToBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-rose-900/60 shadow-2xl text-white space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-500">
                <Ban className="w-5 h-5 stroke-[2.5]" />
                <h3 className="font-extrabold text-base text-white">
                  Block Personnel Workstation Access
                </h3>
              </div>
              <button
                onClick={() => setUserToBlock(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-900/50 space-y-1">
                <div className="text-rose-300 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Executive Workstation Lockout</span>
                </div>
                <div className="text-slate-300 text-[11px]">
                  You are about to block this user from accessing any workstation pages:
                </div>
                <div className="pt-2 font-mono text-xs text-white space-y-0.5">
                  <div><strong>Name:</strong> {userToBlock.firstName} {userToBlock.lastName}</div>
                  <div><strong>Email:</strong> {userToBlock.email}</div>
                  <div><strong>Role:</strong> {userToBlock.role.replace(/_/g, ' ')}</div>
                  <div><strong>Ghana Card:</strong> {userToBlock.ghanaCard || 'N/A'}</div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Suspension Reason (Displayed to User on Locked Screen)
                </label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g. Administrative Suspension, Disciplinary Review"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <p className="text-slate-400 text-[11px] leading-relaxed">
                While blocked, this user's active session will immediately lock on all devices (mobile, laptop, tablet). They will have zero access until you click <b>Unblock</b>.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToBlock(null)}
                disabled={isBlocking}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmBlockUser}
                disabled={isBlocking}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Ban className="w-4 h-4" />
                <span>{isBlocking ? 'Blocking...' : 'Block Workstation'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
