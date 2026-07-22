import React, { useState } from 'react';
import { Calculator, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

export const LoanCalculatorWidget: React.FC = () => {
  const [amount, setAmount] = useState<number>(5000);
  const [tenorDays, setTenorDays] = useState<number>(30);

  // E-RIKON Rate Policy Logic
  const getTenorPolicy = (days: number) => {
    if (days <= 28) {
      return { category: '1 Day – 4 Weeks', rate: 0.10, ratePercent: '10%' };
    } else if (days <= 90) {
      return { category: '1 Month – 3 Months', rate: 0.15, ratePercent: '15%' };
    } else if (days <= 180) {
      return { category: '3 Months – 6 Months', rate: 0.25, ratePercent: '25%' };
    } else {
      return { category: '6 Months – 12 Months', rate: 0.30, ratePercent: '30%' };
    }
  };

  const policy = getTenorPolicy(tenorDays);
  const interestAmount = amount * policy.rate;
  const totalRepayable = amount + interestAmount;
  const monthlyRepayment = totalRepayable / Math.max(1, Math.ceil(tenorDays / 30));

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-white shadow-2xl space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
              ER-Fast Loan Calculator
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                OFFICIAL POLICY
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              E-RIKON Group Tenor Tiered Rate Simulation Engine
            </p>
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
      </div>

      {/* Input Form Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Principal Amount */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 flex justify-between">
            <span>Requested Principal</span>
            <span className="text-amber-400 font-mono font-extrabold">GHS {amount.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min="500"
            max="50000"
            step="500"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-amber-500 bg-slate-800 rounded-lg cursor-pointer h-2"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>GHS 500</span>
            <span>GHS 50,000</span>
          </div>
        </div>

        {/* Tenor Days */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 flex justify-between">
            <span>Loan Tenor (Duration)</span>
            <span className="text-amber-400 font-mono font-extrabold">{tenorDays} Days</span>
          </label>
          <input
            type="range"
            min="7"
            max="365"
            step="7"
            value={tenorDays}
            onChange={(e) => setTenorDays(Number(e.target.value))}
            className="w-full accent-amber-500 bg-slate-800 rounded-lg cursor-pointer h-2"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>7 Days</span>
            <span>365 Days</span>
          </div>
        </div>
      </div>

      {/* Policy Tier Rate Indicator Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: '1 Day – 4 Wks', rate: '10%', days: 28 },
          { label: '1 Mo – 3 Mos', rate: '15%', days: 90 },
          { label: '3 Mos – 6 Mos', rate: '25%', days: 180 },
          { label: '6 Mos – 12 Mos', rate: '30%', days: 365 },
        ].map((tier, idx) => {
          const isActive = policy.ratePercent === tier.rate;
          return (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                isActive
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">{tier.label}</div>
              <div className="text-base font-extrabold mt-0.5">{tier.rate}</div>
              <div className="text-[9px] mt-0.5 text-slate-500 font-mono">Interest Rate</div>
            </div>
          );
        })}
      </div>

      {/* Calculated Breakdown Card */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
          <span className="text-slate-400">Selected Tenor Tier:</span>
          <span className="font-bold text-amber-400">{policy.category} ({policy.ratePercent})</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Interest</div>
            <div className="text-sm font-extrabold text-amber-400 font-mono">GHS {interestAmount.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Total Repayable</div>
            <div className="text-sm font-extrabold text-emerald-400 font-mono">GHS {totalRepayable.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Est. Monthly</div>
            <div className="text-sm font-extrabold text-white font-mono">GHS {monthlyRepayment.toFixed(2)}</div>
          </div>
        </div>
      </div>

    </div>
  );
};
