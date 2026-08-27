import React, { useState } from 'react';
import { Calculator, Sparkles } from 'lucide-react';

export const LoanCalculatorWidget: React.FC = () => {
  const [amount, setAmount] = useState<number>(100);
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
  const interestAmount = amount > 0 ? amount * policy.rate : 0;
  const totalRepayable = amount > 0 ? amount + interestAmount : 0;
  const monthlyRepayment = amount > 0 ? totalRepayable / Math.max(1, Math.ceil(tenorDays / 30)) : 0;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-white shadow-2xl space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5 flex-wrap">
              ER-Fast Loan Calculator
              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 whitespace-nowrap">
                POLICY
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Tenor Tiered Simulation (Min GH₵ 100 • Interval GH₵ 50)
            </p>
          </div>
        </div>
        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
      </div>

      {/* Input Controls Stacked to prevent container squeezing */}
      <div className="space-y-4">
        
        {/* Principal Amount Section */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-300">
              Requested Principal (GH₵)
            </label>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setAmount((prev) => Math.max(100, prev - 50))}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-400 font-bold text-xs flex items-center justify-center cursor-pointer transition-all border border-slate-700 shrink-0"
                title="Decrease by GH₵ 50"
              >
                -50
              </button>
              <div className="text-amber-400 font-mono font-black text-xs sm:text-sm px-2.5 py-1 bg-amber-500/10 rounded-xl border border-amber-500/20 whitespace-nowrap">
                GHS {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <button
                type="button"
                onClick={() => setAmount((prev) => Math.min(50000, prev + 50))}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-400 font-bold text-xs flex items-center justify-center cursor-pointer transition-all border border-slate-700 shrink-0"
                title="Increase by GH₵ 50"
              >
                +50
              </button>
            </div>
          </div>
          
          <input
            type="range"
            min="100"
            max="50000"
            step="50"
            value={amount}
            onChange={(e) => setAmount(Math.max(100, Number(e.target.value)))}
            className="w-full accent-amber-500 bg-slate-800 rounded-lg cursor-pointer h-2"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Min: GH₵ 100</span>
            <span className="text-amber-500/80 font-bold">+GH₵ 50 step</span>
            <span>Max: GH₵ 50,000</span>
          </div>

          {/* Quick Amount Selector Chips in multiples of 50 */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[100, 150, 200, 250, 300, 500, 1000, 2500, 5000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  amount === preset
                    ? 'bg-amber-500 text-slate-950 font-black ring-1 ring-amber-400 shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                +GH₵ {preset >= 1000 ? `${preset / 1000}k` : preset}
              </button>
            ))}
          </div>
        </div>

        {/* Tenor Duration Section */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">Loan Tenor (Duration)</span>
            <span className="text-amber-400 font-mono font-extrabold px-2 py-0.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
              {tenorDays} Days
            </span>
          </div>
          <input
            type="range"
            min="7"
            max="365"
            step="7"
            value={tenorDays}
            onChange={(e) => setTenorDays(Number(e.target.value))}
            className="w-full accent-amber-500 bg-slate-800 rounded-lg cursor-pointer h-2"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>7 Days</span>
            <span>30 Days</span>
            <span>90 Days</span>
            <span>365 Days</span>
          </div>
        </div>

      </div>

      {/* Policy Tier Rate Indicator Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: '1D – 4Wks', rate: '10%', days: 28 },
          { label: '1Mo – 3Mos', rate: '15%', days: 90 },
          { label: '3Mos – 6Mos', rate: '25%', days: 180 },
          { label: '6Mos – 12Mos', rate: '30%', days: 365 },
        ].map((tier, idx) => {
          const isActive = policy.ratePercent === tier.rate;
          return (
            <div
              key={idx}
              className={`p-2 rounded-xl border text-center transition-all ${
                isActive
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md ring-1 ring-amber-500/30'
                  : 'bg-slate-950/40 border-slate-800 text-slate-400'
              }`}
            >
              <div className="text-[9px] text-slate-400 uppercase tracking-wider truncate">{tier.label}</div>
              <div className="text-sm font-extrabold mt-0.5">{tier.rate}</div>
              <div className="text-[8px] text-slate-500 font-mono">Interest</div>
            </div>
          );
        })}
      </div>

      {/* Calculated Breakdown Card */}
      <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
          <span className="text-slate-400">Selected Tier:</span>
          <span className="font-bold text-amber-400 text-right">{policy.category} ({policy.ratePercent})</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
          <div className="p-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="text-[9px] text-slate-400 uppercase font-mono">Interest</div>
            <div className="text-xs sm:text-sm font-extrabold text-amber-400 font-mono mt-0.5">
              GHS {interestAmount.toFixed(2)}
            </div>
          </div>
          <div className="p-1.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
            <div className="text-[9px] text-emerald-300/80 uppercase font-mono">Repayable</div>
            <div className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono mt-0.5">
              GHS {totalRepayable.toFixed(2)}
            </div>
          </div>
          <div className="p-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="text-[9px] text-slate-400 uppercase font-mono">Est. Monthly</div>
            <div className="text-xs sm:text-sm font-extrabold text-white font-mono mt-0.5">
              GHS {monthlyRepayment.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
