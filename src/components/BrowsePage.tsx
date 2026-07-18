import React, { useState, useEffect } from 'react';
import { Startup, UserProfileData, Category } from '../types';
import { CATEGORY_FIELDS } from '../categoryFields';
import { apiFetch as fetch } from '../lib/api';
import { trackEvent } from '../lib/analytics';

interface BrowsePageProps {
  setView: (view: string) => void;
  setSelectedStartupId: (id: string) => void;
  searchQuery: string;
  onActionToast: (message: string) => void;
  user: UserProfileData;
  categories: Category[];
}

export default function BrowsePage({
  setView,
  setSelectedStartupId,
  searchQuery,
  onActionToast,
  user,
  categories,
}: BrowsePageProps) {
  const [startups, setStartups] = useState<Startup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [subFilters, setSubFilters] = useState<Record<string, any>>({});
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [listingTypeFilter, setListingTypeFilter] = useState<string>('All');
  const [socialProof, setSocialProof] = useState<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const itemsPerPage = 12;

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    // Social proof fetch
    fetch('/api/social-proof')
      .then(res => res.json())
      .then(data => setSocialProof(data))
      .catch(console.error);

    // Referral code handling from URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('savdo24_referral_code', refCode);
      onActionToast(`Referral kod (${refCode}) muvaffaqiyatli saqlandi!`);
    }
  }, []);

  const fetchFilteredStartups = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (listingTypeFilter !== 'All') params.append('listingType', listingTypeFilter);
      if (onlyActive) params.append('onlyActive', 'true');
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      // Note: subFilters are tricky to pass as query params if they are dynamic.
      // For now, let's just use the core filters. 
      // If we need subfilters, we'd need to JSON stringify them or append individually.

      const res = await fetch(`/api/startups?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStartups(data.startups || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      console.error("Fetch filtered startups error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFilteredStartups();
  }, [selectedCategory, debouncedSearch, listingTypeFilter, onlyActive, currentPage]);

  // Reset page to 1 when filters change (except for currentPage itself)
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, debouncedSearch, listingTypeFilter, onlyActive]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      onActionToast("Iltimos, yaroqli elektron pochta manzili kiriting.");
      return;
    }
    
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail })
      });
      const data = await res.json();
      if (res.ok) {
        onActionToast(data.message || `Muvaffaqiyatli obuna bo'lindi!`);
        setNewsletterEmail('');
      } else {
        onActionToast(data.error || "Xatolik yuz berdi");
      }
    } catch (err) {
      onActionToast("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
    }
  };

  const handleCardClick = (id: string) => {
    trackEvent('listing_view', id, 'browse_page');
    setSelectedStartupId(id);
    setView('detail');
  };

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Social Proof Widget */}
      {socialProof && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-primary-container border border-outline-variant/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div>
              <p className="text-[10px] text-on-primary-container uppercase font-bold">Savdolar (24s)</p>
              <p className="text-lg font-black text-white">{socialProof.sales24h}</p>
            </div>
          </div>
          <div className="bg-primary-container border border-outline-variant/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <span className="material-symbols-outlined">person_add</span>
            </div>
            <div>
              <p className="text-[10px] text-on-primary-container uppercase font-bold">Yangi a'zolar</p>
              <p className="text-lg font-black text-white">{socialProof.newUsers24h}</p>
            </div>
          </div>
          <div className="bg-primary-container border border-outline-variant/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <span className="material-symbols-outlined">rocket_launch</span>
            </div>
            <div>
              <p className="text-[10px] text-on-primary-container uppercase font-bold">Yangi e'lonlar</p>
              <p className="text-lg font-black text-white">{socialProof.newListings24h}</p>
            </div>
          </div>
          <div className="bg-primary-container border border-outline-variant/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <span className="material-symbols-outlined">star</span>
            </div>
            <div>
              <p className="text-[10px] text-on-primary-container uppercase font-bold">Top Sharh</p>
              <p className="text-xs font-bold text-white truncate max-w-[100px]">
                {socialProof.topRated ? `"${socialProof.topRated.comment}"` : "Hali yo'q"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Featured Opportunity Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-primary-container min-h-[400px] flex items-center p-6 md:p-12 border border-outline-variant/20 transition-all">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-container via-primary-container/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-2xl text-left">
          <span className="inline-block bg-secondary-container/20 text-secondary-container border border-secondary-container/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            G'oyalaringizni ulashing
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-6 leading-tight select-none">
            Startaplar, AI mahsulotlar va tayyor loyihalarni xarid qiling yoki soting
          </h1>
          <p className="text-sm md:text-base text-on-primary-container mb-8 leading-relaxed max-w-lg">
            O'zbekistondagi raqamli mahsulotlar bozori — startap g'oyalaridan AI promptlar, botlar va saytlargacha. Xarid qiling, soting, va jamoa bilan g'oyalarni muhokama qiling.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => {
                const element = document.getElementById('listings-title');
                if (element) element.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-secondary-container text-on-secondary-fixed hover:brightness-110 active:scale-95 transition-all px-8 py-4 rounded-xl font-bold text-sm shadow-md shadow-secondary-container/10"
            >
              Elonlarni ko'rish
            </button>
            <button
              onClick={() => setView('sell')}
              className="border border-outline-variant text-white hover:bg-white/10 active:scale-95 transition-all px-8 py-4 rounded-xl font-bold text-sm"
            >
              Elon qo'shish
            </button>
          </div>
        </div>

        {/* G'oyalar va startaplar bozori surati (Hidden on mobile) */}
        <div className="hidden lg:block absolute right-6 bottom-0 w-1/2 h-full">
          <img
            className="w-full h-full object-contain object-right-bottom p-4 max-h-[380px]"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0iLGg-o6MQzTDLv1u5AjmyWEA7UwnBl07faLmhB9Lskr3vDBhBkAvHMSU94EOGnfeZ2WXSt8R_6kVK6qrJIsjTKKADfxvmQzJh5lKX1sQqs7YDjY9uuEeCTXERqBb233TqiEPyV-KQN8wGLFKheOFBmjKICwB6vVNx-l4p_dIElaGoETLdPaxA1Z4TLX5e86GVNoX7acF2qLdndudADhXDwxb93oXoUtubCd4o59IQDBh5CpmBxHzUWyx2pYWZVGzwiplk9y-yHE"
            alt="G'oyalar va startaplar bozori modeli"
            loading="lazy"
            width={500}
            height={380}
          />
        </div>
      </section>

      {/* Explore Categories */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-on-surface dark:text-white">
            Kategoriyalarni o'rganish
          </h2>
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSubFilters({});
            }}
            className="text-secondary-container hover:underline text-sm font-semibold flex items-center gap-1"
          >
            Barchasini ko'rish
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          {categories.map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(isCatActive ? null : cat.id);
                  setSubFilters({});
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer group transition-all duration-300 ${
                  isCatActive
                    ? 'bg-secondary-container/20 border-secondary-container shadow-md'
                    : 'bg-white dark:bg-primary-container/40 border-outline-variant/20 hover:border-secondary-container/50 hover:shadow-sm'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
                    isCatActive
                      ? 'bg-secondary-container text-on-secondary-fixed'
                      : 'bg-surface dark:bg-white/5 text-secondary-container group-hover:bg-secondary-container group-hover:text-on-secondary-fixed'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                </div>
                <span className="text-xs font-bold text-on-surface dark:text-white group-hover:text-secondary-container transition-colors text-center">
                  {cat.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Dynamic Category Specific Sub-filters */}
        {selectedCategory && CATEGORY_FIELDS[selectedCategory] && (
          <div className="mt-6 p-4 bg-white dark:bg-primary-container/20 border border-outline-variant/10 rounded-2xl animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-secondary-container uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">tune</span>
                Qo'shimcha filtrlar
              </span>
              {Object.values(subFilters).some(v => v !== '' && v !== false) && (
                <button
                  onClick={() => setSubFilters({})}
                  className="text-xs text-red-400 hover:underline font-bold flex items-center gap-1"
                >
                  Filtrlarni tozalash
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {CATEGORY_FIELDS[selectedCategory].map((field) => {
                if (field.type === 'checkbox') {
                  return (
                    <div key={field.key} className="flex items-center gap-2 py-2">
                      <input
                        type="checkbox"
                        id={`filter-${field.key}`}
                        className="w-4 h-4 accent-secondary-container bg-[#0b1426] border border-outline-variant/30 rounded cursor-pointer"
                        checked={!!subFilters[field.key]}
                        onChange={(e) => setSubFilters({ ...subFilters, [field.key]: e.target.checked })}
                      />
                      <label htmlFor={`filter-${field.key}`} className="text-xs font-semibold text-gray-300 cursor-pointer select-none">
                        {field.label}
                      </label>
                    </div>
                  );
                } else if (field.type === 'select') {
                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs text-gray-400 block">{field.label}</label>
                      <select
                        className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-2 text-xs focus:outline-none focus:border-secondary-container transition-all"
                        value={subFilters[field.key] || ''}
                        onChange={(e) => setSubFilters({ ...subFilters, [field.key]: e.target.value })}
                      >
                        <option value="">Barchasi</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                } else {
                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs text-gray-400 block">{field.label}</label>
                      <input
                        type={field.type}
                        className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-2 text-xs focus:outline-none focus:border-secondary-container transition-all"
                        placeholder={field.placeholder || "Izlash..."}
                        value={subFilters[field.key] || ''}
                        onChange={(e) => setSubFilters({ ...subFilters, [field.key]: e.target.value })}
                        aria-label={field.label}
                      />
                    </div>
                  );
                }
              })}
            </div>
          </div>
        )}
      </section>

      {/* Startup Grid (Active/All Listings) */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 id="listings-title" className="text-xl md:text-2xl font-bold text-on-surface dark:text-white">
            E'lonlar ro'yxati
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-left">
            {/* E'lon turi select */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-[#8892b0] whitespace-nowrap">Turi:</label>
              <select
                value={listingTypeFilter}
                onChange={(e) => setListingTypeFilter(e.target.value)}
                className="bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-secondary-container transition-all"
              >
                <option value="All">Barchasi</option>
                <option value="To'liq loyiha (manba kodi bilan)">To'liq loyiha (manba kodi bilan)</option>
                <option value="Faqat litsenziya (foydalanish huquqi)">Faqat litsenziya (foydalanish huquqi)</option>
                <option value="Manba kodisiz tayyor mahsulot">Manba kodisiz tayyor mahsulot</option>
              </select>
            </div>

            {/* Faqat faol e'lonlar checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#8892b0] select-none">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="w-4 h-4 accent-secondary-container bg-[#0b1426] border border-outline-variant/30 rounded cursor-pointer"
                aria-label="Faqat faol e'lonlar"
              />
              Faqat faol e'lonlar
            </label>

            {/* View Mode Toggle */}
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className={`p-1.5 border rounded-lg transition-colors border-outline-variant/30 hover:bg-white/5 text-[#8892b0]`}
              title={viewMode === 'grid' ? "Ro'yxat ko'rinishi" : "Jadval ko'rinishi"}
              aria-label={viewMode === 'grid' ? "Ro'yxat ko'rinishiga o'tish" : "Jadval ko'rinishiga o'tish"}
            >
              <span className="material-symbols-outlined text-lg leading-none">
                {viewMode === 'grid' ? 'view_list' : 'grid_view'}
              </span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-primary-container/40 border border-outline-variant/20 rounded-2xl overflow-hidden p-6 space-y-4 animate-pulse">
                <div className="h-48 bg-white/5 rounded-xl"></div>
                <div className="h-6 bg-white/10 rounded-md w-2/3"></div>
                <div className="h-4 bg-white/5 rounded-md w-full"></div>
                <div className="h-4 bg-white/5 rounded-md w-5/6"></div>
                <div className="flex justify-between items-center pt-4">
                  <div className="h-8 bg-white/10 rounded-lg w-1/3"></div>
                  <div className="h-10 bg-secondary-container/10 rounded-xl w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (startups.length === 0) ? (
          <div className="text-center py-16 border border-dashed border-outline-variant/20 rounded-xl bg-white/5 max-w-lg mx-auto flex flex-col items-center p-8">
            <span className="material-symbols-outlined text-5xl text-on-primary-container mb-3">folder_open</span>
            <p className="text-on-primary-container font-semibold mb-4 text-base">
              {selectedCategory 
                ? "Bu kategoriyada hali e'lonlar yo'q. Birinchi bo'lib siz qo'shing!" 
                : "Sizning filtrlaringizga mos keladigan startaplar topilmadi."}
            </p>
            {selectedCategory ? (
              <button
                onClick={() => setView('sell')}
                className="px-6 py-2.5 bg-[#f0b90b] text-black font-extrabold text-sm rounded-xl hover:brightness-110 transition-all active:scale-95 shadow-md flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm font-bold">add</span>
                E'lon qo'shish
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setListingTypeFilter('All');
                  setSubFilters({});
                }}
                className="text-secondary-container underline text-sm mt-2 font-bold"
              >
                Filtrlarni tozalash
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in"
            : "flex flex-col gap-4 animate-fade-in"
          }>
            {startups.map((startup) => {
              if (viewMode === 'list') {
                return (
                  <div
                    key={startup.id}
                    className="bg-white dark:bg-primary-container/40 border border-outline-variant/20 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col md:flex-row p-5 gap-6 items-center text-left w-full"
                  >
                    <div className="w-full md:w-56 h-36 relative overflow-hidden bg-white/5 rounded-xl shrink-0 cursor-pointer animate-fade-in" onClick={() => handleCardClick(startup.id)}>
                      <img
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        src={startup.image}
                        alt={`${startup.name} - ${categories.find(c => c.id === startup.category)?.name || 'startap'} loyihasi muqovasi`}
                        loading="lazy"
                        width={224}
                        height={144}
                      />
                      {startup.soldStatus === 'sotildi' && (
                        <div className="absolute inset-0 bg-red-600/70 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="text-white font-black text-xs uppercase tracking-widest px-3 py-1 border border-white rounded-lg">SOTILDI</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-grow flex flex-col justify-between py-1 w-full animate-fade-in">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3
                            onClick={() => handleCardClick(startup.id)}
                            className="font-extrabold text-lg text-on-surface dark:text-white cursor-pointer hover:text-secondary-container transition-colors flex items-center gap-2"
                          >
                            {startup.name}
                            {startup.isTop && (
                              <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">vertical_align_top</span>
                                TOP
                              </span>
                            )}
                          </h3>
                          <span className="material-symbols-outlined text-secondary-container text-md select-none">
                            verified
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant dark:text-on-primary-container line-clamp-2 mb-4 leading-relaxed">
                          {startup.description}
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-on-primary-container">
                        <span className="px-2.5 py-1 bg-white/5 rounded-lg border border-white/5 uppercase text-[10px]">
                          {categories.find(c => c.id === startup.category)?.name || startup.category}
                        </span>
                        <span className="px-2.5 py-1 bg-white/5 rounded-lg border border-white/5 text-[10px]">{startup.listingType}</span>
                        <span className="text-secondary-container font-black text-sm">${startup.price ? startup.price.toLocaleString() : "Kelishilgan holda"} USDT</span>
                      </div>
                    </div>
                    
                    <div className="shrink-0 w-full md:w-auto ml-auto">
                      <button
                        onClick={() => handleCardClick(startup.id)}
                        className="w-full md:w-auto px-6 py-3 bg-secondary-container hover:brightness-115 text-on-secondary-fixed rounded-xl font-bold text-xs shadow-md shadow-secondary-container/10 transition-all active:scale-95 whitespace-nowrap"
                      >
                        Batafsil ko'rish
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={startup.id}
                  className="bg-white dark:bg-primary-container/40 border border-outline-variant/20 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col text-left"
                >
                  <div className="h-48 relative overflow-hidden bg-white/5">
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      src={startup.image}
                      alt={`${startup.name} - ${categories.find(c => c.id === startup.category)?.name || 'startap'} loyihasi muqovasi`}
                      loading="lazy"
                      width={350}
                      height={192}
                    />
                    <div className="absolute top-4 left-4 bg-primary-container/90 text-white border border-white/10 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                      {categories.find(c => c.id === startup.category)?.name || startup.category}
                    </div>
                    {startup.soldStatus === 'sotildi' && (
                      <div className="absolute inset-0 bg-red-600/70 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-white font-black text-xs uppercase tracking-widest px-3 py-1 border border-white rounded-lg">SOTILDI</span>
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-grow flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3
                        onClick={() => handleCardClick(startup.id)}
                        className="font-extrabold text-lg text-on-surface dark:text-white cursor-pointer hover:text-secondary-container transition-colors flex items-center gap-2"
                      >
                        {startup.name}
                        {startup.isTop && (
                          <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">vertical_align_top</span>
                            TOP
                          </span>
                        )}
                      </h3>
                      <span className="material-symbols-outlined text-secondary-container text-md select-none">
                        verified
                      </span>
                    </div>

                    <p className="text-xs text-on-surface-variant dark:text-on-primary-container line-clamp-2 mb-6 leading-relaxed">
                      {startup.description}
                    </p>

                    <div className="flex flex-col gap-3 p-4 bg-surface dark:bg-white/5 rounded-xl mb-6 mt-auto">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-on-primary-container">Sotish narxi</span>
                        <span className="font-mono font-bold text-secondary-container text-sm">
                          ${startup.price ? startup.price.toLocaleString() : "Kelishilgan holda"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-on-primary-container">E'lon turi</span>
                        <span className="font-mono text-[11px] text-white font-semibold leading-tight text-right truncate max-w-[140px]">
                          {startup.listingType || "To'liq loyiha (manba kodi bilan)"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-on-primary-container border-t border-white/5 pt-2 mt-1">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">code</span>
                          {startup.repoIncluded ? "Repo + Kod ✅" : "Faqat litsenziya"}
                        </span>
                        <span>
                          {startup.soldStatus === 'sotildi' ? (
                            <span className="text-red-500 font-extrabold">Sotildi 🔴</span>
                          ) : (
                            <span className="text-green-500 font-extrabold">Sotuvda 🟢</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCardClick(startup.id)}
                      className="w-full py-3 bg-primary-container dark:bg-white/10 text-white dark:hover:bg-secondary-container dark:hover:text-on-secondary-fixed hover:bg-secondary-container hover:text-on-secondary-fixed rounded-xl font-bold text-sm transition-colors mt-auto shadow-sm"
                    >
                      Tafsilotlarni ko'rish
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8 animate-fade-in">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white disabled:opacity-40 disabled:hover:bg-white/5 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">chevron_left</span>
              Oldingi
            </button>

            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, index) => {
                const pageNum = index + 1;
                const isCurrent = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-[#f3ba2f] text-[#12161c]"
                        : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white disabled:opacity-40 disabled:hover:bg-white/5 transition-all flex items-center gap-1 cursor-pointer"
            >
              Keyingi
              <span className="material-symbols-outlined text-xs">chevron_right</span>
            </button>
          </div>
        )}
      </section>

      {/* Newsletter Subscription */}
      <section className="p-6 md:p-12 rounded-2xl bg-secondary-container flex flex-col lg:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none transform translate-x-12 -translate-y-12">
          <span className="material-symbols-outlined text-[200px]">mail</span>
        </div>
        
        <div className="relative z-10 max-w-lg text-left">
          <h2 className="text-xl md:text-3xl font-extrabold text-on-secondary-fixed mb-2">
            Eng yangi g'oyalardan xabardor bo'ling
          </h2>
          <p className="text-xs md:text-sm text-on-secondary-fixed-variant leading-relaxed">
            E'lon qilingan eng yaxshi takliflar va dolzarb innovatsion g'oyalar haqidagi haftalik hisobotlarni elektron pochtangizga olish uchun obuna bo'ling.
          </p>
        </div>

        <form onSubmit={handleSubscribe} className="relative z-10 flex w-full lg:w-auto gap-4">
          <input
            type="email"
            className="flex-grow lg:w-80 rounded-xl border-none focus:ring-2 focus:ring-primary-container px-4 py-3 bg-white/40 placeholder-on-secondary-fixed-variant text-on-secondary-fixed font-semibold outline-none text-sm transition-all"
            placeholder="Elektron pochtangizni kiriting"
            value={newsletterEmail}
            onChange={(e) => setNewsletterEmail(e.target.value)}
            aria-label="Elektron pochta manzili"
          />
          <button
            type="submit"
            className="bg-primary-container text-white px-8 py-3 rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all whitespace-nowrap shadow-md"
          >
            Obuna bo'lish
          </button>
        </form>
      </section>
    </div>
  );
}
