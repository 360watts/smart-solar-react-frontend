import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getSecurityCardStyles } from './styles';
import PasswordChangeModal from './PasswordChangeModal';

interface SecurityCardProps {
  /** When true, renders only the "Change Password" button (no card wrapper). */
  triggerOnly?: boolean;
}

const SecurityCard: React.FC<SecurityCardProps> = ({ triggerOnly = false }) => {
  const { isDark } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const styles = getSecurityCardStyles(isDark);

  const button = (
    <button
      onClick={() => setShowModal(true)}
      style={styles.button as React.CSSProperties}
    >
      <Lock size={14} style={{ marginRight: 6 }} />
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
