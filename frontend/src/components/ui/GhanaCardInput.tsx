import React from 'react';

interface GhanaCardInputProps {
  value: string;
  onChange: (formattedValue: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  dark?: boolean;
}

export const GhanaCardInput: React.FC<GhanaCardInputProps> = ({
  value,
  onChange,
  placeholder = '123456789-0',
  required = false,
  className = '',
  dark = false,
}) => {
  // Helper to format raw text into GHA-XXXXXXXXX-X
  const formatGhanaCard = (inputStr: string): string => {
    // Strip everything except alphanumeric characters
    let raw = inputStr.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // If starts with GHA, strip GHA prefix
    if (raw.startsWith('GHA')) {
      raw = raw.slice(3);
    }

    // Keep only alphanumeric characters for the body (up to 10 chars)
    const cleanChars = raw.slice(0, 10);

    if (cleanChars.length === 0) {
      return '';
    } else if (cleanChars.length <= 9) {
      return `GHA-${cleanChars}`;
    } else {
      // 9 digits + '-' + 1 check digit
      return `GHA-${cleanChars.slice(0, 9)}-${cleanChars.slice(9, 10)}`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatGhanaCard(e.target.value);
    onChange(formatted);
  };

  // Get raw value without leading 'GHA-' for input display
  const displayValue = value.startsWith('GHA-') ? value.slice(4) : value;

  return (
    <div className="relative flex items-center">
      <div className="absolute left-3 font-mono font-black text-amber-500 text-xs pointer-events-none select-none tracking-wider flex items-center gap-1">
        <span>GHA-</span>
      </div>
      <input
        required={required}
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={11} // 9 digits + '-' + 1 digit
        style={dark ? { color: '#ffffff' } : undefined}
        className={`w-full pl-14 pr-3 py-2.5 rounded-xl font-mono font-bold text-xs focus:outline-none focus:border-amber-500 tracking-wider ${
          dark
            ? 'bg-slate-950 border border-slate-800 text-white !text-white placeholder-slate-500'
            : 'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400'
        } ${className}`}
      />
    </div>
  );
};
