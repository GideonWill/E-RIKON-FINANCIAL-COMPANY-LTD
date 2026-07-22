import React from 'react';

interface GhanaCardInputProps {
  value: string;
  onChange: (formattedValue: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const GhanaCardInput: React.FC<GhanaCardInputProps> = ({
  value,
  onChange,
  placeholder = '722104918-3',
  required = false,
  className = '',
}) => {
  // Helper to format raw text into GHA-XXXXXXXXX-X
  const formatGhanaCard = (inputStr: string): string => {
    // Strip everything except alphanumeric characters
    let raw = inputStr.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // If starts with GHA, strip GHA
    if (raw.startsWith('GHA')) {
      raw = raw.slice(3);
    }

    // Keep only numeric characters for the body
    const digitsOnly = raw.replace(/[^0-9]/g, '').slice(0, 10); // max 10 digits

    if (digitsOnly.length === 0) {
      return '';
    } else if (digitsOnly.length <= 9) {
      return `GHA-${digitsOnly}`;
    } else {
      // 9 digits + 1 check digit
      return `GHA-${digitsOnly.slice(0, 9)}-${digitsOnly.slice(9, 10)}`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatGhanaCard(e.target.value);
    onChange(formatted);
  };

  return (
    <div className="relative flex items-center">
      <div className="absolute left-3 font-mono font-extrabold text-amber-500 text-xs pointer-events-none select-none">
        GHA-
      </div>
      <input
        required={required}
        type="text"
        value={value.startsWith('GHA-') ? value.slice(4) : value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={13} // 9 digits + '-' + 1 digit = max 11 chars after GHA-
        className={`w-full pl-14 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-500 tracking-wider ${className}`}
      />
    </div>
  );
};
