import React from 'react';

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
  placeholder = 'Enter Ghana ID (numbers only)',
  required = false,
  className = '',
  dark = false,
}) => {
  // Only numbers allowed (0-9), no prefixes, no hyphens, no enforced formats
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digitsOnly = raw.replace(/\D/g, '');
    onChange(digitsOnly);
  };

  // Ensure displayed value is numbers only
  const displayDigits = (value || '').replace(/\D/g, '');

  return (
    <div className="relative flex items-center w-full">
      <input
        required={required}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={displayDigits}
        onChange={handleChange}
        placeholder={placeholder}
        style={dark ? { color: '#ffffff' } : undefined}
        className={`w-full px-3.5 py-2.5 rounded-xl font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488] tracking-wider transition-all ${
          dark
            ? 'bg-slate-950 border border-slate-800 text-white !text-white placeholder-slate-500'
            : 'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500'
        } ${className}`}
      />
    </div>
  );
};
