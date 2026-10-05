import React, { ReactNode, ReactElement, useRef, useEffect } from 'react';
import { gsap } from 'gsap';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Returns true if the error is a Vite/Webpack dynamic import failure (stale chunk after deploy). */
function isChunkLoadError(error: Error): boolean {
  const msg = error?.message ?? '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('dynamically imported module') ||
    // Safari
    (error?.name === 'TypeError' && msg.includes('import('))
  );
}

/** Hard-reload to pick up new chunks after a Vercel redeploy. Allows one retry per 30s. */
function reloadOnce(): void {
  const RELOAD_KEY = 'chunk_load_reload';
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  if (Date.now() - last > 30_000) {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }
}

function ErrorFallback({ message, onReset }: { message: string; onReset: () => void }): ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { reduceMotion: '(prefers-reduced-motion: reduce)' },
      (context) => {
        const { reduceMotion } = context.conditions as { reduceMotion: boolean };
        const tl = gsap.timeline({ defaults: { duration: reduceMotion ? 0 : 0.5, ease: 'power3.out' } });
        tl.from(cardRef.current, { autoAlpha: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.96 });
        if (!reduceMotion) {
          tl.from(iconRef.current, { scale: 0, rotation: -15, ease: 'back.out(1.7)', duration: 0.45 }, 0.1);
          gsap.to(iconRef.current, {
            scale: 1.06, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: tl.duration() + 0.1,
          });
        }
        return () => gsap.killTweensOf([cardRef.current, iconRef.current]);
      },
    );
    return () => mm.revert();
  }, []);

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div
        ref={cardRef}
        style={{
          position: 'relative',
          maxWidth: 440,
          width: '100%',
          padding: '36px 32px',
          borderRadius: 22,
          textAlign: 'center',
          background: 'var(--surface-muted, rgba(255,255,255,0.75))',
          backdropFilter: 'blur(24px)',
          border: '1px solid var(--border, rgba(148,163,184,0.18))',
          boxShadow: '0 20px 60px -20px rgba(220,38,38,0.25), inset 0 1px 0 rgba(255,255,255,0.4)',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at top, rgba(220,38,38,0.14), transparent 65%)',
          }}
        />
        <div
          ref={iconRef}
          style={{
            position: 'relative', width: 56, height: 56, margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'rgba(220,38,38,0.12)',
            border: '1px solid rgba(220,38,38,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--destructive, #DC2626)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>

        <h2
          style={{
            margin: '0 0 8px', fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: '1.15rem', letterSpacing: '-0.01em', color: 'var(--foreground)',
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            margin: '0 0 24px', fontFamily: 'var(--font-body)', fontSize: '0.85rem',
            lineHeight: 1.5, color: 'var(--muted-foreground)',
            wordBreak: 'break-word',
          }}
        >
          {message}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={onReset}
            style={{
              padding: '10px 22px',
              background: 'var(--destructive, #DC2626)',
              color: 'var(--destructive-foreground, #fff)',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(220,38,38,0.35)',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 22px',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border, rgba(148,163,184,0.25))',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (isChunkLoadError(error)) {
      reloadOnce();
      return;
    }
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    sessionStorage.removeItem('chunk_load_reload');
    this.setState({ hasError: false, error: null });
  };

  render(): ReactElement {
    if (this.state.hasError) {
      // If it's a chunk error we already triggered a reload — show nothing (blank avoids flash).
      if (this.state.error && isChunkLoadError(this.state.error)) {
        return <></> as unknown as ReactElement;
      }

      return (
        <ErrorFallback
          message={this.state.error?.message || 'An unexpected error occurred.'}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children as ReactElement;
  }
}

export default ErrorBoundary;
