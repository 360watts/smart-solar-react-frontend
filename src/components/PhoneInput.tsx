import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Country {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: 'IN', dialCode: '+91',  name: 'India',          flag: '🇮🇳' },
  { code: 'US', dialCode: '+1',   name: 'United States',  flag: '🇺🇸' },
  { code: 'GB', dialCode: '+44',  name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AE', dialCode: '+971', name: 'UAE',             flag: '🇦🇪' },
  { code: 'SG', dialCode: '+65',  name: 'Singapore',      flag: '🇸🇬' },
  { code: 'AU', dialCode: '+61',  name: 'Australia',      flag: '🇦🇺' },
  { code: 'DE', dialCode: '+49',  name: 'Germany',        flag: '🇩🇪' },
  { code: 'FR', dialCode: '+33',  name: 'France',         flag: '🇫🇷' },
  { code: 'CA', dialCode: '+1',   name: 'Canada',         flag: '🇨🇦' },
  { code: 'MY', dialCode: '+60',  name: 'Malaysia',       flag: '🇲🇾' },
  { code: 'ZA', dialCode: '+27',  name: 'South Africa',   flag: '🇿🇦' },
  { code: 'NG', dialCode: '+234', name: 'Nigeria',        flag: '🇳🇬' },
  { code: 'KE', dialCode: '+254', name: 'Kenya',          flag: '🇰🇪' },
  { code: 'PK', dialCode: '+92',  name: 'Pakistan',       flag: '🇵🇰' },
  { code: 'BD', dialCode: '+880', name: 'Bangladesh',     flag: '🇧🇩' },
  { code: 'LK', dialCode: '+94',  name: 'Sri Lanka',      flag: '🇱🇰' },
  { code: 'NP', dialCode: '+977', name: 'Nepal',          flag: '🇳🇵' },
];

/** Parse a stored value like "+91 9876543210" → { dialCode: "+91", local: "9876543210" } */
function parseStored(value: string): { dialCode: string; local: string } {
  const match = value?.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) {
    const found = COUNTRIES.find(c => c.dialCode === match[1]);
    if (found) return { dialCode: match[1], local: match[2] };
  }
  return { dialCode: '+91', local: value || '' };
}

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  required?: boolean;
  isDark?: boolean;
  placeholder?: string;
  /** Inline-style variant (used in Users/Employees inline-styled forms) */
  inlineStyle?: boolean;
  disabled?: boolean;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  required,
  isDark = false,
  placeholder = '98765 43210',
  inlineStyle = false,
  disabled = false,
}) => {
  const parsed = parseStored(value);
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [local, setLocal]       = useState(parsed.local);
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync when parent value changes externally (e.g. form reset)
  useEffect(() => {
    const p = parseStored(value);
    setDialCode(p.dialCode);
    setLocal(p.local);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleDialCode = (code: string) => {
    setDialCode(code);
    setOpen(false);
    setSearch('');
    onChange(local ? `${code} ${local}` : code);
  };

  const handleLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = e.target.value.replace(/[^\d\s\-()]/g, '');
    setLocal(num);
    onChange(num ? `${dialCode} ${num}` : '');
  };

  const filtered = COUNTRIES.filter(
    c => c.name.toLowerCase().includes(search.toLowerCase()) || c.dialCode.includes(search)
  );

  const selected = COUNTRIES.find(c => c.dialCode === dialCode) || COUNTRIES[0];

  const inputBorder  = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb';
  const inputBg      = isDark ? '#2a2a2a' : '#ffffff';
  const inputColor   = isDark ? '#f3f4f6' : '#111827';
  const dropBg       = isDark ? '#1e1e1e' : '#ffffff';
  const dropBorder   = isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb';
  const hoverBg      = isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';

  const wrapStyle: React.CSSProperties = inlineStyle
    ? { display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: inputBorder, width: '100%', boxSizing: 'border-box' as const }
    : { display: 'flex', borderRadius: 8, overflow: 'hidden', border: inputBorder, width: '100%' };

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={dropdownRef}>
      <div style={wrapStyle}>
        {/* Country selector button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '0 10px',
            background: isDark ? '#333' : '#f9fafb',
            border: 'none',
            borderRight: inputBorder,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            color: inputColor,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            height: inlineStyle ? 40 : 42,
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>{selected.flag}</span>
          <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{dialCode}</span>
          <ChevronDown size={12} style={{ opacity: 0.6, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
        </button>

        {/* Phone number input */}
        <input
          type="tel"
          value={local}
          onChange={handleLocal}
          required={required}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: inlineStyle ? '0 12px' : '10px 12px',
            background: inputBg,
            border: 'none',
            color: inputColor,
            fontSize: '0.875rem',
            outline: 'none',
            minWidth: 0,
            height: inlineStyle ? 40 : 42,
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
          background: dropBg, border: dropBorder,
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          width: 240, maxHeight: 280, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: dropBorder }}>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country..."
              style={{
                width: '100%', padding: '6px 8px', borderRadius: 6,
                border: inputBorder, background: inputBg, color: inputColor,
                fontSize: '0.813rem', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map(c => (
              <button
                key={c.code + c.dialCode}
                type="button"
                onClick={() => handleDialCode(c.dialCode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 12px', border: 'none',
                  background: dialCode === c.dialCode ? hoverBg : 'transparent',
                  color: inputColor, cursor: 'pointer', fontSize: '0.875rem',
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = dialCode === c.dialCode ? hoverBg : 'transparent')}
              >
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{c.dialCode}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '12px', color: inputColor, opacity: 0.5, fontSize: '0.813rem', textAlign: 'center' }}>
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneInput;
