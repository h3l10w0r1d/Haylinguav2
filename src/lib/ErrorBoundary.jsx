import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
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
