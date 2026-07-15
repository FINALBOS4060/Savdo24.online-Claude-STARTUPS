import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b1426] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full p-8 bg-[#0e1726] border border-yellow-500/30 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-yellow-500 animate-pulse"></div>
            
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto border border-yellow-500/20 text-yellow-500">
              <span className="material-symbols-outlined text-4xl">warning</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">Tizim xatoligi yuz berdi</h1>
              <p className="text-xs text-[#8892b0] leading-relaxed">
                Kutilmagan xatolik tufayli sahifa yuklanmadi. Iltimos, quyidagi tugmalar yordamida sahifani yangilang yoki bosh sahifaga qayting.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-left max-h-32 overflow-y-auto">
                <span className="text-[10px] font-mono text-yellow-500/80 block uppercase font-bold mb-1">Xato tafsiloti:</span>
                <code className="text-[10px] font-mono text-gray-400 break-all">{this.state.error.message}</code>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                onClick={this.handleGoHome}
                className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Bosh sahifaga o'tish
              </button>
              <button
                onClick={this.handleReload}
                className="py-3 bg-[#f3ba2f] hover:brightness-110 text-[#12161c] font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-yellow-500/10"
              >
                Kodni qayta yuklash
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
