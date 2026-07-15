export const getSecurityCardStyles = (isDark: boolean, customerMode = false) => {
  const cardBg     = customerMode
    ? (isDark ? 'rgba(10,20,14,0.96)' : 'rgba(252,255,253,0.97)')
    : (isDark ? 'linear-gradient(145deg, #0F1623 0%, #0D1320 100%)' : '#FFFFFF');
  const cardBorder = customerMode
    ? (isDark ? 'rgba(47,191,113,0.13)' : 'rgba(47,191,113,0.18)')
    : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)');
  const divider = customerMode
    ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')
    : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)');
  const titleColor = customerMode
    ? ('var(--success-soft)')
    : ('var(--foreground)');
  const descColor = customerMode
    ? (isDark ? 'rgba(240,247,242,0.45)' : 'rgba(13,35,24,0.45)')
    : (isDark ? '#8892A4' : 'var(--muted-foreground)');
  const font = customerMode ? '"DM Sans", system-ui, sans-serif' : "'Outfit', sans-serif";

  return {
    card: {
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 16,
      padding: '20px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 20,
      paddingBottom: 16,
      borderBottom: `1px solid ${divider}`,
    },
    iconBox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: 'rgba(47,191,113,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#2FBF71',
    },
    title: {
      margin: 0,
      fontSize: 15,
      fontFamily: font,
      fontWeight: 700,
      color: titleColor,
    },
    description: {
      margin: '0 0 16px',
      fontSize: 13,
      color: descColor,
      fontFamily: font,
    },
    button: {
      padding: '10px 20px',
      background: 'transparent',
      color: '#2FBF71',
      border: '1.5px solid #2FBF71',
      borderRadius: 9,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontFamily: font,
    },
  };
};
