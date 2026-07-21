import React, { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { UserProfileData, Notification } from '../types';
import { apiFetch as fetch } from '../lib/api';

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
            className={`font-semibold text-sm transition-colors py-1 ${
              currentView === 'ideas-rating'
                ? 'text-secondary-container border-b-2 border-secondary-container'
                : 'text-on-primary-container hover:text-secondary-container'
            }`}
          >
            🏆 G'oyalar reytingi
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
          <span className="material-symbols-outlined text-on-primary-container text-sm select-none">search</span>
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

        {/* Notifications */}
        {user.name !== 'Mehmon' && (
          <div className="relative">
            <button
              onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
              className="p-2 text-on-primary-container hover:text-secondary-container transition-colors rounded-lg bg-white/5 relative"
              title="Bildirishnomalar"
            >
              <span className="material-symbols-outlined select-none text-xl leading-none">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
                      className="text-[10px] font-bold text-[#f0b90b] hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Barchasini o'qildi deb belgilash
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <span className="material-symbols-outlined text-4xl text-on-primary-container mb-2">notifications_off</span>
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
                              const path = notif.link.replace(/^\//, '');
                              setView(path);
                            }
                          }
                        }}
                        className={`p-4 border-b border-outline-variant/5 cursor-pointer transition-colors ${
                          !notif.isRead ? 'bg-secondary-container/5 hover:bg-secondary-container/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-xs font-bold ${!notif.isRead ? 'text-[#f0b90b]' : 'text-white'}`}>
                            {notif.title}
                          </h4>
                          {!notif.isRead && <div className="w-2 h-2 rounded-full bg-[#f0b90b]" />}
                        </div>
                        <p className="text-[11px] text-on-primary-container leading-relaxed mb-2">
                          {notif.message}
                        </p>
                        <span className="text-[9px] text-on-primary-container/60">
                          {new Date(notif.createdAt).toLocaleString()}
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
          <span className="material-symbols-outlined select-none text-xl leading-none">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <button
          onClick={() => setView('profile')}
          className="hidden sm:block font-semibold text-sm text-on-primary-container hover:text-secondary-container transition-colors"
        >
          <span className="flex items-center gap-1.5">
            {user.isVip && <span className="text-[14px]" title="VIP a'zo">👑</span>}
            {user.name !== 'Mehmon' ? user.name : 'Kirish'}
          </span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-on-primary-container hover:text-secondary-container transition-colors"
          aria-label={mobileMenuOpen ? "Menuni yopish" : "Menuni ochish"}
        >
          <span className="material-symbols-outlined select-none">
            {mobileMenuOpen ? 'close' : 'menu'}
          </span>
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
            <span>🏆</span> G'oyalar reytingi
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
              <span className="material-symbols-outlined text-xl">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
              <span>Mavzu</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
