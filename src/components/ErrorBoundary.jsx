import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * React Error Boundary — catches unhandled UI errors
 * and shows a recovery screen instead of crashing the app.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to centralized logger if available
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => window.location.reload();
  handleGoHome = () => { window.location.hash = ''; window.location.reload(); };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-slate-400 mb-6">
            An unexpected error occurred. Your data is safe — try refreshing the page.
          </p>

          {/* Error details (collapsed by default) */}
          {this.state.error && (
            <details className="mb-6 text-left">
              <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-300 transition">
                Show error details
              </summary>
              <pre className="mt-2 p-3 bg-slate-800 rounded-lg text-xs text-red-300 overflow-auto max-h-40">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
            >
              <Home className="w-4 h-4" />
              Go to Dashboard
            </button>
          </div>

          <p className="text-xs text-slate-600 mt-6">
            KOB WMS Pro v1.0 — If this persists, contact your system administrator.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
