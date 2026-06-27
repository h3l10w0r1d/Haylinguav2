import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Error tracking — loaded ONLY when VITE_SENTRY_DSN is set, as a separate chunk,
// so the SDK never bloats the main bundle for users.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  import('@sentry/react')
    .then((Sentry) => {
      // Error reporting only (no perf tracing) to keep the chunk small.
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
      });
      window.__sentry = Sentry;
    })
    .catch(() => {});
}

function ErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50/40 to-white px-6 text-center">
      <div className="font-display text-2xl font-extrabold text-slate-800">Oops — something went wrong</div>
      <p className="mt-2 max-w-sm font-semibold text-slate-500">
        We hit an unexpected error. Refreshing the page usually fixes it.
      </p>
      <button onClick={() => window.location.reload()} className="btn3d btn3d-brand mt-6 uppercase">
        Reload
      </button>
    </div>
  );
}

// Plain boundary so we don't pull the SDK into the main bundle; it reports to
// Sentry if/when the SDK has loaded.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    if (typeof window !== 'undefined' && window.__sentry?.captureException) {
      window.__sentry.captureException(error);
    }
  }
  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
