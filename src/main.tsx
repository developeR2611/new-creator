import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CRATOR] Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-[#f3f0ea] flex items-center justify-center p-6 selection:bg-white selection:text-black font-sans">
          <div className="max-w-md w-full bg-[#111215] border border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center mx-auto text-xl font-bold font-display">
              !
            </div>
            <div className="space-y-1">
              <h2 className="font-display font-bold text-lg text-white">Something went wrong</h2>
              <p className="text-xs text-[#8e8a91]">
                An unexpected error occurred while loading media. You can safely reload the cinema player.
              </p>
            </div>
            {this.state.error && (
              <pre className="text-[10px] font-mono text-left bg-black/60 p-3 rounded-lg text-rose-300/80 overflow-x-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="primary-btn w-full h-10 rounded-xl text-xs font-semibold"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Global safety listener for cross-origin unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[CRATOR] Unhandled Promise Rejection prevented:', event.reason);
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
