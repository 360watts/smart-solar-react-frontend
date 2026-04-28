import React, { ReactNode, ReactElement } from 'react';

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

/** Hard-reload once to pick up the new chunk after a Vercel redeploy. */
function reloadOnce(): void {
  const RELOAD_KEY = 'chunk_load_reload';
  if (!sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, '1');
    window.location.reload();
  }
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
        <div
          style={{
            padding: '20px',
            margin: '20px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
          }}
        >
          <h2 style={{ color: '#c33', margin: '0 0 10px 0' }}>⚠️ Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: '15px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 16px',
              backgroundColor: '#c33',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children as ReactElement;
  }
}

export default ErrorBoundary;
