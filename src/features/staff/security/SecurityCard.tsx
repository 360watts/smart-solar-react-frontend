import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getSecurityCardStyles } from './styles';
import PasswordChangeModal from './PasswordChangeModal';

interface SecurityCardProps {
  triggerOnly?: boolean;
  /** Use orange accent for customer portal (default: green for staff). */
  customerMode?: boolean;
}

const SecurityCard: React.FC<SecurityCardProps> = ({ triggerOnly = false, customerMode = false }) => {
  const { isDark } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(false);
  const styles = getSecurityCardStyles(isDark, customerMode);
  const accent = '#2FBF71';

  const button = (
    <button
      onClick={() => setShowModal(true)}
      style={{
        ...(styles.button as React.CSSProperties),
        display: 'flex', alignItems: 'center', gap: 8,
        color: hovered ? '#fff' : accent,
        border: `1.5px solid ${accent}`,
        background: hovered ? accent : 'transparent',
        boxShadow: hovered ? `0 2px 10px ${accent}30` : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Lock size={14} />
      Change Password
    </button>
  );

  return (
    <>
      {triggerOnly ? button : (
        <div style={styles.card as React.CSSProperties}>
          <div style={styles.header as React.CSSProperties}>
            <div style={styles.iconBox as React.CSSProperties}>
              <Lock size={14} />
            </div>
            <h3 style={styles.title as React.CSSProperties}>Security</h3>
          </div>
          <p style={styles.description as React.CSSProperties}>
            Manage your account security and password settings.
          </p>
          {button}
        </div>
      )}

      {showModal && (
        <PasswordChangeModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
};

export default SecurityCard;
