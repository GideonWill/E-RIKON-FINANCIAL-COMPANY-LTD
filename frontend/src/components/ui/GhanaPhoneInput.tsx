import React from 'react';

interface GhanaPhoneInputProps {
  value: string;
  onChange: (formattedPhone: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  dark?: boolean;
  variant?: 'box' | 'pill';
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
  variant = 'box',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatGhanaianPhoneNumber(e.target.value);
    onChange(formatted);
  };

  const digitsCount = (value || '').replace(/\D/g, '').length;
  const isComplete = digitsCount === 10;

  if (variant === 'pill') {
    return (
      <div className="relative flex items-center w-full">
        <input
          required={required}
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={10}
          style={{ color: '#0f172a' }}
          className={`w-full bg-transparent text-slate-900 !text-slate-900 placeholder:!text-slate-500 placeholder-slate-500 text-xs font-semibold focus:outline-none font-mono ${className}`}
        />
        <div className="absolute right-0 pointer-events-none select-none text-[9px] font-mono font-bold flex items-center">
          <span
            className={`px-1.5 py-0.5 rounded-full ${
              isComplete
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            {digitsCount}/10
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center w-full">
      <input
        required={required}
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={10}
        style={dark ? { color: '#ffffff' } : { color: '#0f172a' }}
        className={`w-full pr-14 pl-3.5 py-2.5 rounded-xl font-mono font-bold text-xs focus:outline-none focus:border-amber-500 tracking-wider transition-all ${
          dark
            ? 'bg-slate-950 border border-slate-800 text-white !text-white placeholder:text-slate-500'
            : 'bg-white border border-slate-300 text-slate-900 !text-slate-900 placeholder:text-slate-400'
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
