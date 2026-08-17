import React from 'react';

interface GhanaPhoneInputProps {
  value: string;
  onChange: (formattedPhone: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  dark?: boolean;
}

/**
 * Normalizes input string to a valid 10-digit Ghanaian phone number (e.g. 0241234567)
 */
export const formatGhanaianPhoneNumber = (input: string): string => {
  if (!input) return '';
  // Strip all non-digit characters
  let digits = input.replace(/\D/g, '');

  // Handle +233 or 233 country prefix: replace leading 233 with 0
  if (digits.startsWith('233') && digits.length > 3) {
    digits = '0' + digits.slice(3);
  }

  // Ensure maximum length is 10 digits
  return digits.slice(0, 10);
};

export const isValidGhanaPhone = (phone: string): boolean => {
  if (!phone) return false;
  const clean = formatGhanaianPhoneNumber(phone);
  return /^0[0-9]{9}$/.test(clean);
};

export const GhanaPhoneInput: React.FC<GhanaPhoneInputProps> = ({
  value,
  onChange,
  placeholder = '0241234567',
  required = false,
  className = '',
  dark = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatGhanaianPhoneNumber(e.target.value);
    onChange(formatted);
  };

  const digitsCount = (value || '').replace(/\D/g, '').length;
  const isComplete = digitsCount === 10;

  return (
    <div className="relative flex items-center">
      <input
        required={required}
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={10}
        style={dark ? { color: '#ffffff' } : undefined}
        className={`w-full pr-14 pl-3.5 py-2.5 rounded-xl font-mono font-bold text-xs focus:outline-none focus:border-amber-500 tracking-wider transition-all ${
          dark
            ? 'bg-slate-950 border border-slate-800 text-white !text-white placeholder-slate-500'
            : 'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400'
        } ${isComplete ? 'border-emerald-500/50' : ''} ${className}`}
      />
      <div className="absolute right-2.5 pointer-events-none select-none text-[10px] font-mono font-extrabold flex items-center gap-1">
        <span
          className={`px-1.5 py-0.5 rounded-md ${
            isComplete
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          {digitsCount}/10
        </span>
      </div>
    </div>
  );
};
