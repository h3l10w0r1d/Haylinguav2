import { Component } from "react";

// A tab left open across a deploy still holds the OLD index.html, which
// references JS chunk filenames by content hash (e.g. Leaderboard-b8143153.js)
// — once a new deploy ships different hashes, that old chunk 404s the moment
// the user navigates to a route that lazy-loads it. Reloading always fixes
// this (the fresh index.html points at the current hashes), so auto-reload
// once instead of showing an error screen for something that isn't really
// broken. The sessionStorage guard stops a genuine, persistent failure (e.g.
// actually offline) from reload-looping forever — if a reload was already
// tried in the last 10s, fall through to the manual "Reload page" UI.
const STALE_CHUNK_PATTERN = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (STALE_CHUNK_PATTERN.test(error?.message || "")) {
      const key = "hay_stale_chunk_reload_at";
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 max-w-sm w-full">
            <div className="mb-3 text-4xl">⚠️</div>
            <h2 className="font-display text-xl font-extrabold text-slate-800">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-500">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="mt-5 w-full rounded-2xl bg-brand-500 py-2.5 text-sm font-extrabold text-white shadow-[0_4px_0_0_#c2410c] transition active:translate-y-0.5"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
