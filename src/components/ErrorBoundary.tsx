import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);

    const errorKey = `${error.name}:${error.message}`;
    if (sessionStorage.getItem(errorKey)) return;
    sessionStorage.setItem(errorKey, 'true');

    fetch('/api/client-error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        browser: navigator.userAgent
      })
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b1426] text-white flex items-center justify-center p-4">
          <div className="max-w-md text-center p-8 bg-white/5 border border-white/10 rounded-3xl shadow-2xl">
            <span className="material-symbols-outlined text-red-500 text-6xl mb-4 select-none">error</span>
            <h2 className="text-2xl font-bold mb-4">Oops! Xatolik yuz berdi</h2>
            <p className="text-gray-400 mb-6 text-sm">
              Sayt kutilmagan xatolikka duch keldi. Iltimos, sahifani yangilang yoki keyinroq qayta urinib ko'ring.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[#f0b90b] text-black font-bold rounded-xl hover:brightness-110 transition-all text-xs"
            >
              Sahifani yangilash
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
