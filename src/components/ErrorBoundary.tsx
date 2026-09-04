import React, { ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isReloadingForChunkError: boolean;
}

// Deploy qilingandan keyin eski hash'li JS-chunk fayllar (masalan
// ProfilePage-BJLJ0JpP.js) serverdan o'chib ketadi, lekin foydalanuvchi
// brauzerida hali ham eski asosiy bundle ochiq turgan bo'lishi mumkin —
// u sahifa ichida (client-side routing bilan) yangi bo'lim ochganda eski
// chunk'ni so'raydi va 404/tarmoq xatosi bilan "Failed to fetch dynamically
// imported module" xatosi chiqadi. Bu haqiqiy dastur xatosi emas, shunchaki
// eskirgan sahifa — shuning uchun buni avtomatik aniqlab, foydalanuvchiga
// xato ekranini ko'rsatmasdan bir marta jimgina sahifani qayta yuklaymiz.
function isChunkLoadError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`.toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('chunkloaderror') ||
    (msg.includes('loading') && msg.includes('chunk'))
  );
}

const CHUNK_RELOAD_FLAG = 'chunk-reload-attempted';

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isReloadingForChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isReloadingForChunkError: false };
  }

  componentDidMount() {
    // Sahifa muvaffaqiyatli ochilgani (xatosiz bir necha soniya turgani) —
    // demak joriy reload yordam berdi. Flag'ni tozalaymiz, shunda keyingi
    // deploy'dan keyin yana bitta yangi chunk xatosi chiqsa, avtomatik
    // qayta yuklash yana bir marta ishlaydi (aks holda flag butun sessiya
    // davomida qolib, faqat birinchi xatodagina avtomatik tuzalgan bo'lardi).
    window.setTimeout(() => {
      sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
    }, 5000);
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (isChunkLoadError(error)) {
      const alreadyTried = sessionStorage.getItem(CHUNK_RELOAD_FLAG);
      if (!alreadyTried) {
        sessionStorage.setItem(CHUNK_RELOAD_FLAG, 'true');
        this.setState({ isReloadingForChunkError: true });
        window.location.reload();
        return;
      }
      // Qayta yuklashdan keyin ham xato takrorlansa — bu haqiqiy muammo,
      // keyingi safar yana avtomatik urinib ko'rish uchun flag'ni tozalaymiz
      // va oddiy xato ekranini ko'rsatamiz.
      sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
    }

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
    if (this.state.isReloadingForChunkError) {
      // Qayta yuklanayotganda alarmli "Oops" ekrani o'rniga bo'sh/neytral holat
      return <div className="min-h-screen bg-background" />;
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-on-primary-container flex items-center justify-center p-4">
          <div className="max-w-md text-center p-8 bg-white/5 border border-white/10 rounded-2xl shadow-2xl">
            <AlertOctagon className="text-red-500 w-16 h-16 mx-auto mb-4 select-none" />
            <h2 className="text-2xl font-bold mb-4">Oops! Xatolik yuz berdi</h2>
            <p className="text-gray-400 mb-6 text-sm">
              Sayt kutilmagan xatolikka duch keldi. Iltimos, sahifani yangilang yoki keyinroq qayta urinib ko'ring.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-secondary text-black font-bold rounded-xl hover:brightness-110 transition-all text-xs"
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
