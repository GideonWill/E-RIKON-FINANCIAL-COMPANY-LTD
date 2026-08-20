import React, { useState } from 'react';
import { 
  getStoredApprovals, 
  saveStoredApprovals, 
  approveRequest, 
  rejectRequest 
} from '../services/api';
import { useRealtimeSync } from '../services/realtimeSync';
import { ApprovalRequest, ApprovalType } from '../types';
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
  ArrowUpRight
} from 'lucide-react';

import { apiClient } from '../services/api';

export const ApprovalsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(getStoredApprovals());
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync pending staff accounts from backend
  const syncPendingFromBackend = async () => {
    try {
      const { data } = await apiClient.get('/auth/pending');
      if (Array.isArray(data)) {
        const localApprovals = getStoredApprovals();
        const merged = [...localApprovals];

        data.forEach((user: any) => {
          const exists = merged.some((a) => a.targetId === user.id || a.details?.email === user.email);
          if (!exists) {
            merged.unshift({
              id: `appr-${user.id}`,
              type: 'STAFF_ROLE_SIGNUP',
              title: `New ${user.role?.replace(/_/g, ' ')} Registration: ${user.firstName} ${user.lastName}`,
              description: `Application received for ${user.role?.replace(/_/g, ' ')} position. Contact: ${user.phone || 'N/A'} | Ghana Card: ${user.ghanaCard || 'N/A'}`,
              targetId: user.id,
              requestedById: user.id,
              requestedByName: `${user.firstName} ${user.lastName}`,
              requestedRole: user.role,
              details: {
                email: user.email,
                phone: user.phone,
                ghanaCard: user.ghanaCard,
                role: user.role,
                branch: user.branch?.name || 'Accra Central Main Branch',
              },
              status: 'PENDING',
              createdAt: user.createdAt || new Date().toISOString(),
            });
          }
        });

        saveStoredApprovals(merged);
        setApprovals(merged);
      }
    } catch {
      setApprovals(getStoredApprovals());
    }
  };

  React.useEffect(() => {
    syncPendingFromBackend();
  }, []);

  // Real-time multi-device subscription
  useRealtimeSync(() => {
    syncPendingFromBackend();
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
      setSelectedItemForAction(null);

      setTimeout(() => {
        setFeedbackMsg(null);
      }, 4000);
    } catch (err: any) {
      alert(err.message || 'Error processing approval');
    }
  };

  const filteredApprovals = approvals.filter((item) => {
    const matchesFilter = selectedFilter === 'ALL' || item.type === selectedFilter || item.status === selectedFilter;
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      item.title.toLowerCase().includes(term) ||
      item.requestedByName.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-rose-500" />
            Super Admin Approvals Hub & Executive Clearance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized Verification Center for Staff Role Signups, Interest Withdrawals & Loan Disbursements
          </p>
        </div>

        {/* Security Badge */}
        <div className={`flex items-center space-x-2 px-3.5 py-2 rounded-2xl border text-xs font-mono font-bold ${
          isSuperAdmin
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          <Lock className="w-4 h-4" />
          <span>{isSuperAdmin ? 'SUPER ADMIN AUTHORIZED TO APPROVE' : 'VIEW-ONLY: APPROVAL RESTRICTED TO SUPER ADMIN'}</span>
        </div>
      </div>

      {/* Clearance Warning if not Super Admin */}
      {!isSuperAdmin && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <span className="font-bold">Executive Clearance Notice:</span> You are currently logged in as <span className="font-mono font-bold">{currentUser?.role}</span>. Operations Administrators and staff can view and review items, but only the **Super Admin** has the authority to approve or reject requests.
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500 text-white font-bold text-xs flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-white hover:text-slate-200 font-mono text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div 
          onClick={() => setSelectedFilter('PENDING')}
          className={`p-5 rounded-3xl border cursor-pointer transition-all ${
            selectedFilter === 'PENDING'
              ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pending Approvals Queue</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-500 font-mono mt-1">
            {pendingCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Awaiting Super Admin Decision
          </div>
        </div>

        <div 
          onClick={() => setSelectedFilter('APPROVED')}
          className={`p-5 rounded-3xl border cursor-pointer transition-all ${
            selectedFilter === 'APPROVED'
              ? 'bg-emerald-500/10 border-emerald-500 text-slate-900 dark:text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Approved & Cleared</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-emerald-500 font-mono mt-1">
            {approvedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Successfully Disbursed / Cleared
          </div>
        </div>

        <div 
          onClick={() => setSelectedFilter('REJECTED')}
          className={`p-5 rounded-3xl border cursor-pointer transition-all ${
            selectedFilter === 'REJECTED'
              ? 'bg-rose-500/10 border-rose-500 text-slate-900 dark:text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Declined / Rejected</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-3xl font-black text-rose-500 font-mono mt-1">
            {rejectedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Did Not Meet Policy Threshold
          </div>
        </div>

      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* Category Filters */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'ALL', label: 'All Items' },
            { key: 'STAFF_ROLE_SIGNUP', label: 'Staff Signups', icon: UserCheck },
            { key: 'COMPANY_INTEREST_WITHDRAWAL', label: 'Interest Vault', icon: PiggyBank },
            { key: 'LOAN_APPROVAL', label: 'Loan Approvals', icon: Calculator },
          ].map((tab) => {
            const isSelected = selectedFilter === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search approval requests..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
          />
        </div>

      </div>

      {/* Approvals List */}
      <div className="space-y-4">
        {filteredApprovals.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">All Approvals Clear</h4>
            <p className="text-xs">No pending requests match the selected criteria.</p>
          </div>
        ) : (
          filteredApprovals.map((item) => {
            const isPending = item.status === 'PENDING';
            const isApproved = item.status === 'APPROVED';
            const isRejected = item.status === 'REJECTED';

            return (
              <div
                key={item.id}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-3 rounded-2xl flex-shrink-0 ${
                      item.type === 'STAFF_ROLE_SIGNUP'
                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        : item.type === 'COMPANY_INTEREST_WITHDRAWAL'
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                    }`}>
                      {item.type === 'STAFF_ROLE_SIGNUP' && <UserCheck className="w-5 h-5" />}
                      {item.type === 'COMPANY_INTEREST_WITHDRAWAL' && <PiggyBank className="w-5 h-5" />}
                      {item.type === 'LOAN_APPROVAL' && <Calculator className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          #{item.id.slice(-8)}
                        </span>
                        <span className="text-[10px] text-slate-400">• {item.createdAt.slice(0, 16).replace('T', ' ')}</span>
                      </div>

                      <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Status & Amount */}
                  <div className="text-right flex sm:flex-col items-center sm:items-end justify-between gap-1">
                    {item.amount && (
                      <div className="text-lg font-black text-amber-500 font-mono">
                        GHS {item.amount.toFixed(2)}
                      </div>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border font-mono ${
                      isApproved
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : isRejected
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                </div>

                {/* Details Breakdown */}
                {item.details && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs font-mono text-slate-600 dark:text-slate-300 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {Object.entries(item.details).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-[10px] uppercase text-slate-400 block">{k}</span>
                        <span className="font-bold truncate block">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Decision / Reviewer Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="text-xs text-slate-400 font-sans">
                    Submitted by: <span className="font-bold text-slate-700 dark:text-slate-200">{item.requestedByName}</span> ({item.requestedRole})
                    {item.reviewedByName && (
                      <span className="ml-2 text-emerald-400">
                        • Reviewed by Super Admin: <strong>{item.reviewedByName}</strong>
                      </span>
                    )}
                  </div>

                  {/* Actions for Super Admin */}
                  {isPending && (
                    <div className="flex items-center space-x-2">
                      {isSuperAdmin ? (
                        <>
                          <button
                            onClick={() => handleOpenActionModal(item, 'REJECT')}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>

                          <button
                            onClick={() => handleOpenActionModal(item, 'APPROVE')}
                            className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1"
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

      {/* Super Admin Action Confirmation Modal */}
      {selectedItemForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
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
                className="text-slate-400 hover:text-white"
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
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAction}
                className={`w-1/2 py-2.5 rounded-xl font-extrabold text-xs shadow-lg cursor-pointer ${
                  actionType === 'APPROVE'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
                    : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                }`}
              >
                {actionType === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
