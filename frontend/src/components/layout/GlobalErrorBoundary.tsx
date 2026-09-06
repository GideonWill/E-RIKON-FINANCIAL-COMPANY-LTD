import React from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary] Caught unexpected error:', error, errorInfo);
  }

  handleReload = () => {
    // Clear potentially corrupted local storage cache while preserving auth token & user
    try {
      const keysToClear = [
        'erikon_customers',
        'erikon_accounts',
        'erikon_transactions',
        'erikon_company_interest',
        'erikon_company_withdrawals',
        'erikon_loans',
        'erikon_deleted_customers',
        'erikon_deleted_users',
        'erikon_approvals',
      ];
      keysToClear.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20 shadow-inner">
              <ExclamationTriangleIcon className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Workstation Display Notice
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                A display refresh was required for this view. Your live database and transactions are fully secured in the vault.
              </p>
              {this.state.error && (
                <div className="p-3 mt-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] font-mono text-slate-700 dark:text-slate-300 text-left overflow-x-auto max-h-32">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center space-x-2 cursor-pointer"
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span>Reload Workstation</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
