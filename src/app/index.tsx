import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import App from './App';

// Catch dynamic import failures that occur outside the React tree
// (e.g., prefetch links, module preloads). On a stale-chunk error after a
// Vercel redeploy, force a hard reload once so the user gets the new bundle.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg: string = reason?.message ?? String(reason ?? '');
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('dynamically imported module') ||
    msg.includes('Importing a module script failed')
  ) {
    const RELOAD_KEY = 'chunk_load_reload';
    if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    }
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);