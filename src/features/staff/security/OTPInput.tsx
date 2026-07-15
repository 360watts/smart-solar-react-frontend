import React, { useRef, useEffect } from 'react';

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
  isDark: boolean;
  disabled?: boolean;
}

const OTPInput: React.FC<OTPInputProps> = ({ value, onChange, onComplete, isDark, disabled = false }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').concat(Array(6 - value.length).fill(''));

  // Handle input change
  const handleChange = (index: number, val: string) => {
    // Only accept digits
    const digit = val.replace(/\D/g, '');
    if (digit.length > 1) return;

    const newValue = digits.map((d, i) => (i === index ? digit : d)).join('');
    onChange(newValue);

    // Auto-tab to next field
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit on full length
    if (newValue.length === 6 && onComplete) {
      setTimeout(onComplete, 100);
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const digits = pasted.replace(/\D/g, '').slice(0, 6);
    onChange(digits);

    if (digits.length === 6 && onComplete) {
      setTimeout(onComplete, 100);
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const tokenBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const tokenBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const tokenText = 'var(--foreground)';

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array(6)
        .fill(0)
        .map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i] || ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            style={{
              width: 44,
              height: 44,
              fontSize: 20,
              fontWeight: 600,
              textAlign: 'center',
              border: `2px solid ${tokenBorder}`,
              borderRadius: 8,
              background: tokenBg,
              color: tokenText,
              fontFamily: "'Fira Code', monospace",
            } as React.CSSProperties}
          />
        ))}
    </div>
  );
};

export default OTPInput;
