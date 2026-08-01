import React from 'react';

// Simple Error Boundary to catch render errors and display them instead of a white screen
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-white p-8 text-black flex items-center justify-center">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold mb-4">Wystąpił błąd aplikacji</h2>
            <pre className="bg-slate-100 p-4 rounded">{String(this.state.error && this.state.error.toString())}</pre>
            <p className="mt-4">Sprawdź konsolę deweloperską (F12) po więcej informacji.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}