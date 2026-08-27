import React from 'react';
import { CreditCard, CheckCircle2 } from 'lucide-react';

export const formatGhanaCardNumber = (val: string): string => {
  if (!val) return '';
  // Strip non-alphanumeric
  const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Extract the core body after GHA if present
  let body = cleaned;
  if (body.startsWith('GHA')) {
    body = body.slice(3);
  }

  // Max 10 characters (9 digits + 1 check digit)
  body = body.slice(0, 10);

  if (body.length === 0) return 'GHA-';
  if (body.length <= 9) {
    return `GHA-${body}`;
  }
  return `GHA-${body.slice(0, 9)}-${body.slice(9, 10)}`;
};

export const isValidGhanaCard = (val: string): boolean => {
  if (!val) return false;
  return /^GHA-[A-Z0-9]{9}-[A-Z0-9]{1}$/i.test(val.trim());
};

interface GhanaCardInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  dark?: boolean;
}

export const GhanaCardInput: React.FC<GhanaCardInputProps> = ({
  value,
  onChange,
  placeholder = 'GHA-000000000-0',
  required = false,
  className = '',
  dark = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow user to clear completely
    if (!raw || raw === 'GHA' || raw === 'GHA-') {
      onChange('');
      return;
    }
    const formatted = formatGhanaCardNumber(raw);
    onChange(formatted);
  };

  const handleFocus = () => {
    if (!value) {
      onChange('GHA-');
    }
  };

  const handleBlur = () => {
    if (value === 'GHA-' || value === 'GHA') {
      onChange('');
    }
  };

  const isComplete = isValidGhanaCard(value);

  return (
    <div className="relative flex items-center w-full">
      <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
        <CreditCard className="w-4 h-4 text-amber-500" />
      </div>

      <input
        required={required}
        type="text"
        maxLength={15}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        style={dark ? { color: '#ffffff' } : undefined}
        className={`w-full pl-10 pr-10 py-2.5 rounded-xl font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 tracking-wider uppercase transition-all ${dark
            ? 'bg-slate-950 border border-slate-800 text-white !text-white placeholder-slate-500'
            : 'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500'
          } ${isComplete ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : ''} ${className}`}
      />

      {isComplete && (
        <div className="absolute right-3.5 flex items-center pointer-events-none text-emerald-500" title="Valid Ghana Card PIN">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
