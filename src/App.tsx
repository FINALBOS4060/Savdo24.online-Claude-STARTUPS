import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
import { apiFetch as fetch } from './lib/api';
import { io } from 'socket.io-client';

export default function App() {
  const [currentView, setView] = useState<string>('browse');
  const [profileTab, setProfileTab] = useState<ProfileTab>('startups');
  const [initialProfileTab, setInitialProfileTab] = useState<ProfileTab | null>(null);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedStartupId, setSelectedStartupId] = useState<string>('ecoflow-systems');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(['ecoflow-systems']);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [checkoutAmount, setCheckoutAmount] = useState<number>(1250.00);

  useEffect(() => {
    if (currentView === 'profile' && initialProfileTab) {
      setProfileTab(initialProfileTab);
      setInitialProfileTab(null);
    }
  }, [currentView, initialProfileTab]);

  // Auth States
  const [token, setToken] = useState<string | null>(localStorage.getItem('savdo24_token'));
  const [user, setUser] = useState<UserProfileData>({
    name: 'Mehmon',
    role: 'Xaridor',
    verified: false,
    joinDate: 'bugun',
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Guest',
  });

  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  
  // Auth Form Inputs
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

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
    if (authModalOpen && googleClientId) {
      window.google?.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential }),
          });
          const data = await res.json();
          if (res.ok) {
            setToken(data.accessToken);
            setUser(data.user);
            localStorage.setItem('savdo24_token', data.accessToken);
            localStorage.setItem('savdo24_refresh_token', data.refreshToken);
            localStorage.setItem('savdo24_user', JSON.stringify(data.user));
            showToast(`Xush kelibsiz, ${data.user.name}!`);
            setAuthModalOpen(false);
          } else {
            showToast(data.error || "Google orqali kirishda xatolik.");
          }
        },
      });
      window.google?.accounts.id.renderButton(
        document.getElementById(`google-signin-button-${authTab}`),
        { theme: 'outline', size: 'large', text: 'continue_with', locale: 'uz' }
      );
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
  }, [toast.visible]);

  // Sync state with global fetch token updates
  useEffect(() => {
    const handleAuthChange = (e: any) => {
      setToken(e.detail.token);
      if (e.detail.logout) {
        setUser({
          name: 'Mehmon',
          role: 'Xaridor',
          verified: false,
          joinDate: 'bugun',
          avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Guest',
        });
        setView('browse');
      }
    };
    window.addEventListener('savdo24_auth_change', handleAuthChange);
    return () => window.removeEventListener('savdo24_auth_change', handleAuthChange);
  }, []);

  // Load User from /api/auth/me (secure httpOnly cookie-based) or localStorage on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(localStorage.getItem('savdo24_token') || 'cookie_authenticated');
        } else {
          const storedUser = localStorage.getItem('savdo24_user');
          const storedToken = localStorage.getItem('savdo24_token');
          if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser));
            setToken(storedToken);
          } else {
            setToken(null);
          }
        }
      } catch (err) {
        console.error("Error fetching current user:", err);
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
    if (token && user.id) {
      const fetchNotifications = async () => {
        try {
          const res = await fetch('/api/notifications');
          if (res.ok) {
            const data = await res.json();
            setNotifications(data);
          }
        } catch (err) {
          console.error("Error fetching notifications:", err);
        }
      };
      fetchNotifications();

      const socket = io();
      socket.emit('join', `user:${user.id}`);
      socket.on('new_notification', (notif: Notification) => {
        setNotifications(prev => [notif, ...prev]);
        showToast(`Yangi bildirishnoma: ${notif.title}`);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token, user.id]);

  // Fetch Startups from our Real API
  const fetchStartups = async () => {
    try {
      const res = await fetch('/api/startups');
      if (res.ok) {
        const data = await res.json();
        setStartups(data);
      } else {
        console.error("Failed to fetch startups from server");
      }
    } catch (err) {
      console.error("Failed to connect to startups API:", err);
    }
  };

  useEffect(() => {
    fetchStartups();
  }, []);

  // Listen to URL pathname changes to support /admin directly!
  useEffect(() => {
    const handleUrlChange = () => {
      if (window.location.pathname === '/admin') {
        setView('admin');
      } else if (window.location.pathname === '/forgot-password') {
        setView('forgot-password');
      } else if (window.location.pathname === '/reset-password') {
        setView('reset-password');
      }
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Update URL pathname when view changes
  useEffect(() => {
    if (currentView === 'admin') {
      if (window.location.pathname !== '/admin') {
        window.history.pushState({}, '', '/admin');
      }
    } else if (currentView === 'forgot-password') {
      if (window.location.pathname !== '/forgot-password') {
        window.history.pushState({}, '', '/forgot-password');
      }
    } else if (currentView === 'reset-password') {
      if (window.location.pathname !== '/reset-password') {
        window.history.pushState({}, '', `/reset-password${window.location.search}`);
      }
    } else if (
      window.location.pathname === '/admin' || 
      window.location.pathname === '/forgot-password' || 
      window.location.pathname === '/reset-password'
    ) {
      window.history.pushState({}, '', '/');
    }
  }, [currentView]);

  // Handle addition of newly published startups (connecting to real full-stack API!)
  const handleAddStartup = async (newStartup: Startup) => {
    if (!token) {
      showToast("Iltimos, startap qo'shish uchun avval tizimga kiring!");
      setAuthModalOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/startups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newStartup),
      });

      if (res.ok) {
        const created = await res.json();
        setStartups((prev) => [created, ...prev]);
        showToast(`${created.name} muvaffaqiyatli tekshiruvga yuborildi.`);
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
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((bId) => bId !== id) : [...prev, id]
    );
  };

  // To'lov muvaffaqiyatli yakunlanganda
  const handleSuccessPayment = () => {
    fetchStartups(); // Reload fresh data with updated progresses & proposals from DB
  };

  const selectedStartup =
    startups.find((s) => s.id === selectedStartupId) || startups[0];

  // Real JWT Login API Call
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('savdo24_token', data.token);
        localStorage.setItem('savdo24_refresh_token', data.refreshToken);
        localStorage.setItem('savdo24_user', JSON.stringify(data.user));
        showToast(`Xush kelibsiz, ${data.user.name}!`);
        setAuthModalOpen(false);
        // Clear forms
        setAuthEmail('');
        setAuthPassword('');
      } else {
        const err = await res.json();
        showToast(err.error || "Login amalga oshmadi.");
      }
    } catch (err) {
      console.error(err);
      showToast("Serverga ulanib bo'lmadi.");
    }
  };

  // Real JWT Register API Call
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          name: authName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('savdo24_token', data.token);
        localStorage.setItem('savdo24_refresh_token', data.refreshToken);
        localStorage.setItem('savdo24_user', JSON.stringify(data.user));
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
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('savdo24_refresh_token');
      await fetch('/api/auth/logout', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
    } catch (err) {
      console.error("Error logging out from server:", err);
    }
    setToken(null);
    setUser({
      name: 'Mehmon',
      role: 'Xaridor',
      verified: false,
      joinDate: 'bugun',
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Guest',
    });
    localStorage.removeItem('savdo24_token');
    localStorage.removeItem('savdo24_refresh_token');
    localStorage.removeItem('savdo24_user');
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
            {user.name !== 'Mehmon' && !user.emailVerified && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in text-left">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-yellow-500 text-2xl mt-0.5">warning</span>
                <div>
                  <h4 className="text-yellow-500 font-extrabold text-sm">Email manzilingiz tasdiqlanmagan!</h4>
                  <p className="text-xs text-on-primary-container leading-relaxed mt-1">
                    Loyihalarni sotib olish yoki yangi startap e'lon qilish uchun email manzilingizni tasdiqlashingiz shart. Pochtangizni ({user.email || 'ro\'yxatdan o\'tgan email'}) tekshiring.
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('savdo24_token');
                    const res = await fetch('/api/auth/resend-verification', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                      const data = await res.json();
                      showToast(data.message || "Tasdiqlash xati qayta yuborildi!");
                    } else {
                      const err = await res.json();
                      showToast(err.error || "Xatolik yuz berdi.");
                    }
                  } catch (e) {
                    showToast("Server bilan ulanish xatosi.");
                  }
                }}
                className="px-4 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-500 font-bold text-xs rounded-xl transition-all whitespace-nowrap active:scale-95 cursor-pointer self-start sm:self-center"
              >
                Xatni qayta yuborish
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {currentView === 'browse' && (
                <BrowsePage
                  startups={startups}
                  setView={setView}
                  setSelectedStartupId={setSelectedStartupId}
                  searchQuery={searchQuery}
                  onActionToast={showToast}
                  user={user}
                  categories={categories}
                />
              )}

              {currentView === 'profile' && (
                <div className="space-y-6">
                  {/* Auth Warning for Guests */}
                  {!token && (
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

                  {token && (
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
                </div>
              )}

              {currentView === 'detail' && (
                <DetailPage
                  startup={selectedStartup}
                  setView={setView}
                  bookmarkedIds={bookmarkedIds}
                  toggleBookmark={toggleBookmark}
                  onActionToast={showToast}
                  setCheckoutAmount={setCheckoutAmount}
                  user={user}
                  categories={categories}
                />
              )}

              {currentView === 'checkout' && (
                <CheckoutPage
                  amount={checkoutAmount}
                  user={user}
                  setUser={setUser}
                  onActionToast={showToast}
                  setView={setView}
                  onSuccessPayment={handleSuccessPayment}
                  startup={selectedStartup}
                />
              )}

              {currentView === 'sell' && (
                <SellPage
                  onAddStartup={handleAddStartup}
                  onActionToast={showToast}
                  setView={setView}
                  categories={categories}
                />
              )}

              {currentView === 'admin' && (
                <AdminPage
                  user={user}
                  startups={startups}
                  fetchStartups={fetchStartups}
                  onActionToast={showToast}
                  setView={setView}
                  categories={categories}
                  fetchCategories={fetchCategories}
                />
              )}

              {currentView === 'ideas-rating' && (
                <IdeasRatingPage
                  setView={setView}
                  setSelectedStartupId={setSelectedStartupId}
                  onActionToast={showToast}
                  categories={categories}
                />
              )}

              {currentView === 'support' && (
                <SupportPage
                  setView={setView}
                />
              )}

              {currentView === 'messages' && (
                <MessagesPage
                  user={user}
                  onActionToast={showToast}
                />
              )}

              {currentView === 'terms' && (
                <TermsPage
                  setView={setView}
                />
              )}

              {currentView === 'privacy' && (
                <PrivacyPage
                  setView={setView}
                />
              )}

              {currentView === 'refund' && (
                <RefundPolicyPage
                  setView={setView}
                />
              )}

              {currentView === 'forgot-password' && (
                <ForgotPasswordPage
                  onNavigate={setView}
                />
              )}

              {currentView === 'reset-password' && (
                <ResetPasswordPage
                  onNavigate={setView}
                />
              )}
            </motion.div>
          </AnimatePresence>
          </div>
        </main>
      </div>

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
                    <label className="text-xs font-bold text-on-primary-container">Email manzili</label>
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-on-primary-container">Parol</label>
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
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#f0b90b] text-black font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all mt-6 shadow-lg shadow-[#f0b90b]/10"
                  >
                    Tizimga kirish
                  </button>
                  <div className="text-center text-xs text-on-primary-container my-4">yoki</div>
                  <div id="google-signin-button-login" className="flex justify-center"></div>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-primary-container">To'liq ism</label>
                    <input
                      type="text"
                      required
                      placeholder="Toshmatov Eshmat"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-primary-container">Email manzili</label>
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-primary-container">Parol</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-[#f0b90b] transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#f0b90b] text-black font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all mt-6 shadow-lg shadow-[#f0b90b]/10"
                  >
                    Ro'yxatdan o'tish
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
