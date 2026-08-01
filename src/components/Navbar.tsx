import React, { useState, useEffect } from 'react';
import { Send, MessageCircle, Search, Bell, BellOff, Sun, Moon, Menu, X, Trophy, Crown } from 'lucide-react';
import { UserProfileData, Notification, ProfileTab } from '../types';
import { apiFetch as fetch } from '../lib/api';
import { formatDateTime } from '../lib/formatDate';

interface NavbarProps {
  currentView: string;
  setView: (view: string) => void;
  user: UserProfileData;
  setUser: React.Dispatch<React.SetStateAction<UserProfileData>>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setSelectedStartupId?: (id: string) => void;
  setProfileTab?: (tab: ProfileTab) => void;
}

export default function Navbar({
  currentView,
  setView,
  user,
  setUser,
  searchQuery,
  setSearchQuery,
  isDark,
  toggleTheme,
  notifications,
  setNotifications,
  setSelectedStartupId,
  setProfileTab,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Sync local search input with prop changes (e.g. reset/clear)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounce the parent state update
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, setSearchQuery]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PATCH' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full h-16 z-50 flex items-center justify-between px-6 bg-primary-container border-b border-outline-variant/30 shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-8">
        <span
          onClick={() => setView('browse')}
          className="text-2xl font-black text-secondary-container tracking-tight cursor-pointer select-none"
        >
          Savdo24
        </span>
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => setView('browse')}
            className={`font-semibold text-sm transition-colors py-1 ${
              currentView === 'browse'
                ? 'text-secondary-container border-b-2 border-secondary-container'
                : 'text-on-primary-container hover:text-secondary-container'
            }`}
          >
            G'oyalar va loyihalar
          </button>
          <button
            onClick={() => setView('ideas-rating')}
            className={`font-semibold text-sm transition-colors py-1 flex items-center gap-1.5 ${
              currentView === 'ideas-rating'
                ? 'text-secondary-container border-b-2 border-secondary-container'
                : 'text-on-primary-container hover:text-secondary-container'
            }`}
          >
            <Trophy className="w-4 h-4 text-yellow-400" />
            G'oyalar reytingi
          </button>
          <button
            onClick={() => setView('browse')}
            className="font-semibold text-sm text-on-primary-container hover:text-secondary-container transition-colors"
          >
            Kategoriyalar
          </button>
          <button
            onClick={() => setView('profile')}
            className="font-semibold text-sm text-on-primary-container hover:text-secondary-container transition-colors"
          >
            Boshqaruv paneli
          </button>
          <button
            onClick={() => setView('sell')}
            className={`font-semibold text-sm transition-colors py-1 ${
              currentView === 'sell'
                ? 'text-secondary-container border-b-2 border-secondary-container'
                : 'text-on-primary-container hover:text-secondary-container'
            }`}
          >
            G'oyani ulashish
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search bar inside header */}
        <div className="hidden lg:flex items-center bg-white/5 dark:bg-on-primary-fixed-variant/20 rounded-lg px-3 py-1.5 border border-outline-variant/30">
          <Search className="w-4 h-4 text-on-primary-container shrink-0" />
          <input
            type="text"
            className="bg-transparent border-none text-white focus:ring-0 text-sm w-48 placeholder-on-primary-container focus:outline-none ml-1"
            placeholder="Loyiha va g'oyalarni qidirish..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>

        <a
          href="https://t.me/Dasturchilar_Python_JS_HTML_CSS"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-on-primary-container hover:text-secondary-container transition-colors rounded-lg bg-white/5 hidden sm:flex"
          title="Telegram guruh"
        >
          <Send className="w-4 h-4" />
        </a>

        {/* MUHIM: MessagesPage /messages yo'lida mavjud edi, lekin uni ochish uchun
            HECH QANDAY menyu/tugma yo'q edi (faqat bildirishnoma orqali topish mumkin
            edi) — endi bu yerga doimiy kirish tugmasi qo'shildi. */}
        {user.name !== 'Mehmon' && (
          <button
            onClick={() => setView('messages')}
            className={`p-2 transition-colors rounded-lg bg-white/5 ${
              currentView === 'messages' ? 'text-secondary-container' : 'text-on-primary-container hover:text-secondary-container'
            }`}
            title="Xabarlar"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        )}

        {/* Notifications */}
        {user.name !== 'Mehmon' && (
          <div className="relative">
            <button
              onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
              className="p-2 text-on-primary-container hover:text-secondary-container transition-colors rounded-lg bg-white/5 relative"
              title="Bildirishnomalar"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifDropdownOpen && (
              <div className="absolute right-0 mt-3 w-80 bg-primary-container border border-outline-variant/30 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center bg-white/5">
                  <h3 className="text-sm font-bold text-white">Bildirishnomalar</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs font-bold text-secondary hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Barchasini o'qildi deb belgilash
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <BellOff className="w-8 h-8 text-on-primary-container mb-2 mx-auto" />
                      <p className="text-xs text-on-primary-container">Hozircha bildirishnomalar yo'q</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={async () => {
                          if (!notif.isRead) await markAsRead(notif.id);
                          
                          if (notif.link) {
                            setNotifDropdownOpen(false);
                            
                            if (notif.link.startsWith('/startup/')) {
                              const startupId = notif.link.split('/')[2];
                              if (setSelectedStartupId) setSelectedStartupId(startupId);
                              setView('detail');
                            } else {
                              // MUHIM: server ba'zi bildirishnomalarni `/profile?tab=sales`
                              // kabi query-param bilan yuboradi, lekin bu param hech qayerda
                              // o'qilmasdi — bosilganda doim standart tabga tushirardi.
                              // Endi `tab` qiymati o'qilib, setProfileTab chaqiriladi.
                              const [rawPath, query] = notif.link.replace(/^\//, '').split('?');
                              if (rawPath === 'profile' && query && setProfileTab) {
                                const tab = new URLSearchParams(query).get('tab');
                                if (tab) setProfileTab(tab as ProfileTab);
                                setView(rawPath);
                              } else {
                                // 93-band: profile'dan boshqa sahifalar (masalan AdminPage)
                                // o'z tabini App.tsx orqali emas, to'g'ridan-to'g'ri URL
                                // query'dan o'qiydi — shu sabab query qismini
                                // tashlab yubormaslik kerak (avval faqat rawPath
                                // uzatilardi, ?tab=... har doim yo'qolib ketardi).
                                setView(rawPath + (query ? `?${query}` : ''));
                              }
                            }
                          }
                        }}
                        className={`p-4 border-b border-outline-variant/5 cursor-pointer transition-colors ${
                          !notif.isRead ? 'bg-secondary-container/5 hover:bg-secondary-container/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-xs font-bold ${!notif.isRead ? 'text-secondary' : 'text-white'}`}>
                            {notif.title}
                          </h4>
                          {!notif.isRead && <div className="w-2 h-2 rounded-full bg-secondary" />}
                        </div>
                        <p className="text-xs text-on-primary-container leading-relaxed mb-2">
                          {notif.message}
                        </p>
                        <span className="text-xs text-on-primary-container/60">
                          {formatDateTime(notif.createdAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Dark Mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-on-primary-container hover:text-secondary-container transition-colors rounded-lg bg-white/5"
          title={isDark ? "Yorug' rejimga o'tish" : "Qorong'i rejimga o'tish"}
          aria-label={isDark ? "Yorug' rejimga o'tish" : "Qorong'i rejimga o'tish"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setView('profile')}
          className="hidden sm:block font-semibold text-sm text-on-primary-container hover:text-secondary-container transition-colors"
        >
          <span className="flex items-center gap-1.5">
            {user.isVip && <span title="VIP a'zo"><Crown className="w-4 h-4 text-yellow-400 fill-yellow-400" /></span>}
            {user.name !== 'Mehmon' ? user.name : 'Kirish'}
          </span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-on-primary-container hover:text-secondary-container transition-colors"
          aria-label={mobileMenuOpen ? "Menuni yopish" : "Menuni ochish"}
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Drawer menu */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 w-full bg-primary-container border-b border-outline-variant/30 shadow-lg p-6 flex flex-col gap-4 md:hidden z-50 animate-fade-in">
          <button
            onClick={() => {
              setView('browse');
              setMobileMenuOpen(false);
            }}
            className="text-left py-2 text-on-primary-container hover:text-secondary-container font-semibold"
          >
            G'oyalarni ko'rish
          </button>
          <button
            onClick={() => {
              setView('ideas-rating');
              setMobileMenuOpen(false);
            }}
            className="text-left py-2 text-secondary-container hover:text-secondary-container font-bold flex items-center gap-1.5"
          >
            <Trophy className="w-4 h-4 text-yellow-400" /> G'oyalar reytingi
          </button>
          <button
            onClick={() => {
              setView('browse');
              setMobileMenuOpen(false);
            }}
            className="text-left py-2 text-on-primary-container hover:text-secondary-container font-semibold"
          >
            Kategoriyalarni o'rganish
          </button>
          <button
            onClick={() => {
              setView('profile');
              setMobileMenuOpen(false);
            }}
            className="text-left py-2 text-on-primary-container hover:text-secondary-container font-semibold"
          >
            Boshqaruv paneli
          </button>
          <button
            onClick={() => {
              setView('sell');
              setMobileMenuOpen(false);
            }}
            className="text-left py-2 text-on-primary-container hover:text-secondary-container font-semibold"
          >
            G'oyani ulashish
          </button>
          <button
            onClick={() => {
              setView('profile');
              setMobileMenuOpen(false);
            }}
            className="text-left py-2 text-on-primary-container hover:text-secondary-container font-semibold"
          >
            Foydalanuvchi profili
          </button>
          <div className="border-t border-outline-variant/10 pt-4 flex justify-between items-center">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-on-primary-container hover:text-secondary-container font-semibold"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>Mavzu</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
