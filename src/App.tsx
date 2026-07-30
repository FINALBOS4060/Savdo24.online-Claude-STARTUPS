import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Startup, UserProfileData, ProfileTab, Category, Notification } from './types';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import BrowsePage from './components/BrowsePage';
import ProfilePage from './components/ProfilePage';
import DetailPage from './components/DetailPage';
import CheckoutPage from './components/CheckoutPage';
import SellPage from './components/SellPage';
import AdminPage from './components/AdminPage';
import IdeasRatingPage from './components/IdeasRatingPage';
import SupportPage from './components/SupportPage';
import MessagesPage from './components/MessagesPage';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import RefundPolicyPage from './components/RefundPolicyPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import Footer from './components/Footer';
import { apiFetch as fetch } from './lib/api';
import { io } from 'socket.io-client';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = location.pathname.substring(1) || 'browse';
  
  const setView = (view: string, id?: string) => {
    if (view === 'browse') navigate('/');
    else if (view === 'login') { navigate('/'); setAuthTab('login'); setAuthModalOpen(true); }
    else if (view === 'detail') navigate(`/startup/${id || selectedStartupId}`);
    else if (view === 'edit-startup') navigate(`/edit-startup/${id}`);
    else navigate(`/${view}`);
  };

  const [profileTab, setProfileTab] = useState<ProfileTab>('startups');
  const [initialProfileTab, setInitialProfileTab] = useState<ProfileTab | null>(null);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedStartupId, setSelectedStartupId] = useState<string>('');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('savdo24_bookmarks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        // Fallback
      }
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [checkoutAmount, setCheckoutAmount] = useState<number>(1250.00);
  const [isLoadingStartups, setIsLoadingStartups] = useState<boolean>(true);

  useEffect(() => {
    if (currentView === 'profile' && initialProfileTab) {
      setProfileTab(initialProfileTab);
      setInitialProfileTab(null);
    }
  }, [currentView, initialProfileTab]);

  // Auth States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfileData>({
    name: 'Mehmon',
    role: 'Xaridor',
    verified: false,
    joinDate: 'bugun',
    avatarUrl: '/default-avatar.jpg',
  });

  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  
  // Auth Form Inputs
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  // 87-band: Kirish/Ro'yxatdan o'tish formalarida submit paytida
  // disabled/loading holati yo'q edi (ProfilePage/BrowsePage/SellPage'dagi
  // 60/74/76/83/84-band bilan bir xil muammo turi) — butun saytdagi ENG
  // muhim formalar, tez-tez bosilsa bir nechta login/register so'rovi
  // yuborilishi mumkin edi.
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Google client ID dynamic state
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoogleClientId = async () => {
      try {
        const res = await fetch('/api/auth/google-client-id');
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            if (data.clientId) {
              setGoogleClientId(data.clientId);
              return;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch Google client ID dynamically:", err);
      }
      setGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID || null);
    };
    fetchGoogleClientId();
  }, []);

  // Animated feedback toast state
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  // Initialize Google Sign-In
  useEffect(() => {
    if (!authModalOpen || !googleClientId) return;

    const buttonElement = document.getElementById(`google-signin-button-${authTab}`);
    if (!buttonElement) return;

    // Only render if element is empty (prevent duplicates)
    if (buttonElement.innerHTML.trim() === '') {
      window.google?.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (res.ok) {
              localStorage.setItem('savdo24_token', data.accessToken);
              setIsAuthenticated(true);
              setUser(data.user);
              showToast(`Xush kelibsiz, ${data.user.name}!`);
              setAuthModalOpen(false);
            } else {
              showToast(data.error || "Google orqali kirishda xatolik.");
            }
          } catch (err) {
            console.error("Google auth error:", err);
            showToast("Google auth xatosi");
          }
        },
      });

      window.google?.accounts.id.renderButton(buttonElement, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        locale: 'uz'
      });
    }
  }, [authModalOpen, authTab, googleClientId]);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
  };

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
    // MUHIM: bu yerda avval faqat [toast.visible] ga bog'liq edi. Agar bitta
    // xabar hali ko'rinib turgan (4s ichida) paytda YANGI showToast() chaqirilsa,
    // `visible` true->true bo'lib qolgani uchun effekt qayta ishga tushmasdi va
    // eski taymer davom etib, yangi xabarni muddatidan oldin yopib yuborardi.
    // Endi `toast.message` ham dependency'ga qo'shildi — har bir yangi xabar
    // o'zining to'liq 4 soniyalik vaqtini oladi.
  }, [toast.visible, toast.message]);

  // Sync state with global fetch token updates
  useEffect(() => {
    const handleAuthChange = (e: any) => {
      if (e.detail.token && e.detail.token !== 'cookie_authenticated') {
        localStorage.setItem('savdo24_token', e.detail.token);
      }
      setIsAuthenticated(!!e.detail.token);
      if (e.detail.logout) {
        localStorage.removeItem('savdo24_token');
        setUser({
          name: 'Mehmon',
          role: 'Xaridor',
          verified: false,
          joinDate: 'bugun',
          avatarUrl: '/default-avatar.jpg',
        });
        setView('browse');
      }
    };
    window.addEventListener('savdo24_auth_change', handleAuthChange);
    return () => window.removeEventListener('savdo24_auth_change', handleAuthChange);
  }, []);

  // Load User from /api/auth/me (secure httpOnly cookie-based) on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.accessToken) {
            localStorage.setItem('savdo24_token', data.accessToken);
          }
          setUser(data.user);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Error fetching current user:", err);
        setIsAuthenticated(false);
      }
    };
    fetchCurrentUser();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let socketInstance: ReturnType<typeof io> | null = null;

    if (!isAuthenticated || !user.id) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok && isMounted) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();

    socketInstance = io({
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket'],
    });

    socketInstance.on('new_notification', (notif: Notification) => {
      if (!isMounted) return;
      setNotifications((prev) => {
        // Prevent duplicate notifications in UI state
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev].slice(0, 50);
      });
      showToast(`Yangi bildirishnoma: ${notif.title}`);
    });

    socketInstance.on('disconnect', () => {
      console.warn("Socket disconnected");
    });

    socketInstance.on('error', (err: any) => {
      console.error("Socket error:", err);
    });

    return () => {
      isMounted = false;
      if (socketInstance) {
        socketInstance.off('new_notification');
        socketInstance.off('disconnect');
        socketInstance.off('error');
        socketInstance.disconnect();
        socketInstance = null;
      }
    };
  }, [isAuthenticated, user.id]);

  // Fetch Startups from our Real API
  const fetchStartups = async () => {
    setIsLoadingStartups(true);
    try {
      // 45-MUAMMO: server endi "o'ziniki" pending/rejected e'lonlarni faqat
      // includeMine=true so'ralganda qaytaradi (BrowsePage'ning ommaviy
      // katalogiga aralashib ketmasligi uchun) — Profil "Mening loyihalarim"
      // bo'limi shu global ro'yxatga tayanadi, shuning uchun bu yerda
      // includeMine=true yuboriladi.
      const res = await fetch('/api/startups?includeMine=true');
      if (res.ok) {
        const data = await res.json();
        setStartups(Array.isArray(data?.startups) ? data.startups : Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to fetch startups from server");
      }
    } catch (err) {
      console.error("Failed to connect to startups API:", err);
    } finally {
      setIsLoadingStartups(false);
    }
  };

  useEffect(() => {
    fetchStartups();
  }, []);

  // Listen to URL pathname changes to support /admin directly!
  useEffect(() => {
    // Initial fetch of notifications if user is logged in
    if (isAuthenticated && user.id) {
      // Logic handled in another useEffect
    }
  }, [isAuthenticated, user.id]);

  // Handle addition of newly published startups (connecting to real full-stack API!)
  const handleAddStartup = async (newStartup: Startup) => {
    if (!isAuthenticated) {
      showToast("Iltimos, startap qo'shish uchun avval tizimga kiring!");
      setAuthModalOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/startups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newStartup),
      });

      if (res.ok) {
        const created = await res.json();
        setStartups((prev) => [created, ...prev]);
        showToast(`${created.name} muvaffaqiyatli tekshiruvga yuborildi.`);
        // 67-MUAMMO: profileTab avvalgi qiymatida qolib ketardi (masalan
        // "settings"), shu sabab yangi joylangan e'lon foydalanuvchiga
        // profilga qaytganda ko'rinmasdi ("yo'qolgandek" tuyulardi).
        // Endi "Mening loyihalarim" tabiga aniq o'tkaziladi.
        setProfileTab('startups');
        setView('profile');
      } else {
        const err = await res.json();
        showToast(err.error || "Xatolik yuz berdi.");
      }
    } catch (err) {
      console.error("Post startup error:", err);
      showToast("Serverga ulanishda xatolik yuz berdi.");
    }
  };

  // Toggle dynamic bookmarks
  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const updated = prev.includes(id) ? prev.filter((bId) => bId !== id) : [...prev, id];
      localStorage.setItem('savdo24_bookmarks', JSON.stringify(updated));
      return updated;
    });
  };

  // To'lov muvaffaqiyatli yakunlanganda
  const handleSuccessPayment = () => {
    fetchStartups(); // Reload fresh data with updated progresses & proposals from DB
  };

  // MUHIM: bu yerda "|| startups[0]" fallback ATAYLAB OLIB TASHLANDI.
  // Avval, agar selectedStartupId hech qanday mos startapga to'g'ri kelmasa
  // (masalan foydalanuvchi to'g'ridan-to'g'ri /checkout ga o'tsa, orqaga qaytsa
  // yoki ro'yxat yangilanib eski ID mos kelmay qolsa), tizim JIMGINA birinchi
  // startapni ("startups[0]") checkout uchun tanlab qo'yardi — bu foydalanuvchi
  // butunlay BOSHQA mahsulot uchun to'lov qilib qo'yishiga olib kelishi mumkin edi.
  // Endi mos kelmasa `undefined` qaytadi va CheckoutPage o'zining
  // "mahsulot tanlanmagan" ogohlantirishini ko'rsatib, xavfsiz tarzda bosh sahifaga
  // yo'naltiradi.
  const selectedStartup =
    startups.find((s) => s.id === selectedStartupId);

  // Real JWT Login API Call
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!authEmail.trim()) {
      showToast("Email manzilingizni kiriting");
      return;
    }
    if (!authPassword.trim()) {
      showToast("Parolingizni kiriting");
      return;
    }
    if (isAuthSubmitting) return;
    setIsAuthSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim().toLowerCase(),
          password: authPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('savdo24_token', data.accessToken);
        setIsAuthenticated(true);
        setUser(data.user);
        showToast(`Xush kelibsiz, ${data.user.name}!`);
        setAuthModalOpen(false);
        // Clear forms
        setAuthEmail('');
        setAuthPassword('');
      } else {
        // Specific error messages
        if (res.status === 401) {
          showToast("Email yoki parol noto'g'ri");
        } else if (res.status === 404) {
          showToast("Akkaunt topilmadi. Ro'yxatdan o'ting");
        } else if (res.status === 429) {
          showToast("Juda ko'p urinish. 15 daqiqa kuting");
        } else {
          showToast(data.error || "Kirishda xatolik yuz berdi");
        }
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err instanceof TypeError) {
        showToast("Serverga ulanib bo'lmadi");
      } else {
        showToast("Noma'lum xatolik yuz berdi");
      }
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Real JWT Register API Call
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthSubmitting) return;
    setIsAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim().toLowerCase(),
          password: authPassword,
          name: authName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('savdo24_token', data.accessToken);
        setIsAuthenticated(true);
        setUser(data.user);
        showToast(`Muvaffaqiyatli ro'yxatdan o'tdingiz, ${data.user.name}!`);
        setAuthModalOpen(false);
        // Clear forms
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
      } else {
        const err = await res.json();
        showToast(err.error || "Ro'yxatdan o'tishda xatolik.");
      }
    } catch (err) {
      console.error(err);
      showToast("Serverga ulanib bo'lmadi.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST'
      });
    } catch (err) {
      console.error("Error logging out from server:", err);
    }
    localStorage.removeItem('savdo24_token');
    setIsAuthenticated(false);
    setUser({
      name: 'Mehmon',
      role: 'Xaridor',
      verified: false,
      joinDate: 'bugun',
      avatarUrl: '/default-avatar.jpg',
    });
    showToast("Tizimdan chiqdingiz.");
    setView('browse');
  };

  return (
    <div className={isDark ? 'dark bg-[#0b1426] text-white min-h-screen' : 'bg-[#f7f9ff] text-[#171c22] min-h-screen'}>
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        setView={setView}
        user={user}
        setUser={setUser}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isDark={isDark}
        toggleTheme={() => setIsDark(!isDark)}
        notifications={notifications}
        setNotifications={setNotifications}
        setSelectedStartupId={setSelectedStartupId}
        setProfileTab={setProfileTab}
      />

      <div className="flex">
        {/* Left Sidebar Menu */}
        <Sidebar
          currentView={currentView}
          setView={setView}
          user={user}
          onActionToast={showToast}
          setProfileTab={setProfileTab}
          profileTab={profileTab}
        />

        {/* Core Main Area */}
        <main className="flex-grow w-full pl-0 lg:pl-64 pt-24 pb-28 md:pb-12 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            {/* Warning and Pages */}
            {user.name !== 'Mehmon' && !user.emailVerified && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in text-left">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-yellow-500 text-2xl mt-0.5">warning</span>
                <div>
                  <h4 className="text-yellow-500 font-extrabold text-sm">Hisobingiz tasdiqlanmagan!</h4>
                  <p className="text-xs text-on-primary-container leading-relaxed mt-1">
                    Loyihalarni sotib olish yoki yangi startap e'lon qilish uchun hisobingizni tasdiqlashingiz shart. Buning uchun shaxsiy tasdiqlash kodingizni oling va <b>@Savdo24_Official_bot</b> botiga <b>/start [kodingiz]</b> deb yozing.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setProfileTab('settings'); setView('profile'); }}
                className="px-4 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-500 font-bold text-xs rounded-xl transition-all whitespace-nowrap active:scale-95 cursor-pointer self-start sm:self-center"
              >
                Kodni olish
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <BrowsePage
                    setView={setView}
                    setSelectedStartupId={setSelectedStartupId}
                    searchQuery={searchQuery}
                    onActionToast={showToast}
                    user={user}
                    categories={categories}
                    isLoading={isLoadingStartups}
                  />
                </motion.div>
              } />

              <Route path="/profile" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-6"
                >
                  {!isAuthenticated && (
                    <div className="bg-[#f0b90b]/10 border border-[#f0b90b]/30 rounded-2xl p-6 text-left flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#f0b90b]/20 flex items-center justify-center text-[#f0b90b]">
                          <span className="material-symbols-outlined">warning</span>
                        </div>
                        <div>
                          <h4 className="text-white font-extrabold text-base">Siz tizimga kirmagansiz</h4>
                          <p className="text-xs text-on-primary-container">Profilni ko'rish, xatcho'plarni saqlash va o'z startaplaringizni joylashtirish uchun tizimga kiring.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setAuthTab('login'); setAuthModalOpen(true); }}
                        className="px-6 py-2.5 bg-[#f0b90b] text-black font-extrabold text-xs rounded-xl hover:brightness-110 transition-all active:scale-95"
                      >
                        Kirish / Ro'yxatdan o'tish
                      </button>
                    </div>
                  )}

                  <ProfilePage
                    startups={startups}
                    setView={setView}
                    setSelectedStartupId={setSelectedStartupId}
                    user={user}
                    setUser={setUser}
                    bookmarkedIds={bookmarkedIds}
                    onActionToast={showToast}
                    activeTab={profileTab}
                    setActiveTab={setProfileTab}
                    categories={categories}
                  />

                  {isAuthenticated && (
                    <div className="text-left pt-4">
                      <button
                        onClick={handleLogout}
                        className="px-6 py-3 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">logout</span>
                        Tizimdan chiqish
                      </button>
                    </div>
                  )}
                </motion.div>
              } />

              <Route path="/startup/:id" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <DetailPage
                    startups={startups}
                    setView={setView}
                    bookmarkedIds={bookmarkedIds}
                    toggleBookmark={toggleBookmark}
                    onActionToast={showToast}
                    setCheckoutAmount={setCheckoutAmount}
                    user={user}
                    categories={categories}
                    setSelectedStartupId={setSelectedStartupId}
                  />
                </motion.div>
              } />

              <Route path="/edit-startup/:id" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <SellPage
                    onAddStartup={handleAddStartup}
                    onActionToast={showToast}
                    setView={setView}
                    categories={categories}
                    isEditing={true}
                    startups={startups}
                    fetchStartups={fetchStartups}
                    setInitialProfileTab={setInitialProfileTab}
                  />
                </motion.div>
              } />

              <Route path="/checkout" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <CheckoutPage
                    amount={checkoutAmount}
                    user={user}
                    setUser={setUser}
                    onActionToast={showToast}
                    setView={setView}
                    onSuccessPayment={handleSuccessPayment}
                    startup={selectedStartup}
                  />
                </motion.div>
              } />

              <Route path="/sell" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <SellPage
                    onAddStartup={handleAddStartup}
                    onActionToast={showToast}
                    setView={setView}
                    categories={categories}
                  />
                </motion.div>
              } />

              <Route path="/admin" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <AdminPage
                    user={user}
                    startups={startups}
                    fetchStartups={fetchStartups}
                    onActionToast={showToast}
                    setView={setView}
                    categories={categories}
                    fetchCategories={fetchCategories}
                  />
                </motion.div>
              } />

              <Route path="/ideas-rating" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <IdeasRatingPage
                    setView={setView}
                    setSelectedStartupId={setSelectedStartupId}
                    onActionToast={showToast}
                    categories={categories}
                  />
                </motion.div>
              } />

              <Route path="/support" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <SupportPage setView={setView} />
                </motion.div>
              } />

              <Route path="/messages" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <MessagesPage user={user} onActionToast={showToast} />
                </motion.div>
              } />

              <Route path="/terms" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <TermsPage setView={setView} />
                </motion.div>
              } />

              <Route path="/privacy" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <PrivacyPage setView={setView} />
                </motion.div>
              } />

              <Route path="/refund" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <RefundPolicyPage setView={setView} />
                </motion.div>
              } />

              <Route path="/forgot-password" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <ForgotPasswordPage onNavigate={setView} />
                </motion.div>
              } />

              <Route path="/reset-password" element={
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <ResetPasswordPage onNavigate={setView} />
                </motion.div>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
          </div>
        </main>
      </div>
      <Footer setView={setView} />

      {/* Global Auth Modal */}
      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-primary-container border border-outline-variant/30 rounded-3xl p-8 shadow-2xl z-10 text-left"
            >
              <button
                onClick={() => setAuthModalOpen(false)}
                className="absolute top-4 right-4 text-on-primary-container hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              {/* Tabs */}
              <div className="flex border-b border-outline-variant/20 mb-6">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`flex-1 pb-3 text-center font-bold text-sm border-b-2 transition-all ${
                    authTab === 'login'
                      ? 'text-[#f0b90b] border-[#f0b90b]'
                      : 'text-on-primary-container border-transparent'
                  }`}
                >
                  Kirish
                </button>
                <button
                  onClick={() => setAuthTab('register')}
                  className={`flex-1 pb-3 text-center font-bold text-sm border-b-2 transition-all ${
                    authTab === 'register'
                      ? 'text-[#f0b90b] border-[#f0b90b]'
                      : 'text-on-primary-container border-transparent'
                  }`}
                >
                  Ro'yxatdan o'tish
                </button>
              </div>

               {authTab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="login-email" className="text-xs font-bold text-on-primary-container">Email manzili</label>
                    <input
                      type="email"
                      id="login-email"
                      required
                      placeholder="email@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label htmlFor="login-password" className="text-xs font-bold text-on-primary-container">Parol</label>
                      <button
                        type="button"
                        id="forgot-password-link"
                        onClick={() => {
                          setAuthModalOpen(false);
                          setView('forgot-password');
                        }}
                        className="text-xs text-emerald-400 hover:underline font-bold bg-transparent border-none cursor-pointer"
                      >
                        Parolni unutdingizmi?
                      </button>
                    </div>
                    <input
                      type="password"
                      id="login-password"
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAuthSubmitting}
                    className="w-full py-3 bg-[#f0b90b] text-black font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all mt-6 shadow-lg shadow-[#f0b90b]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAuthSubmitting ? 'Kuting...' : 'Tizimga kirish'}
                  </button>
                  <div className="text-center text-xs text-on-primary-container my-4">yoki</div>
                  <div id="google-signin-button-login" className="flex justify-center"></div>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="register-name" className="text-xs font-bold text-on-primary-container">To'liq ism</label>
                    <input
                      type="text"
                      id="register-name"
                      required
                      placeholder="Toshmatov Eshmat"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="register-email" className="text-xs font-bold text-on-primary-container">Email manzili</label>
                    <input
                      type="email"
                      id="register-email"
                      required
                      placeholder="email@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="register-password" className="text-xs font-bold text-on-primary-container">Parol</label>
                    <input
                      type="password"
                      id="register-password"
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAuthSubmitting}
                    className="w-full py-3 bg-[#f0b90b] text-black font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all mt-6 shadow-lg shadow-[#f0b90b]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAuthSubmitting ? 'Kuting...' : "Ro'yxatdan o'tish"}
                  </button>
                  <div className="text-center text-xs text-on-primary-container my-4">yoki</div>
                  <div id="google-signin-button-register" className="flex justify-center"></div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom mobile bar navigation */}
      <MobileNav
        currentView={currentView}
        setView={setView}
        onActionToast={showToast}
        setProfileTab={setProfileTab}
        profileTab={profileTab}
        setInitialProfileTab={setInitialProfileTab}
      />

      {/* Beautiful Animated Toast Banner */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50 flex items-center gap-3 bg-primary-container text-white px-5 py-4 rounded-xl border border-secondary-container/40 shadow-2xl glass-panel max-w-sm"
          >
            <div className="w-8 h-8 rounded-full bg-secondary-container/20 text-secondary-container flex items-center justify-center border border-secondary-container/30">
              <span className="material-symbols-outlined text-sm">notifications_active</span>
            </div>
            <p className="text-xs font-semibold leading-relaxed text-left">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
