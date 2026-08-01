import React from 'react';
import { Clock, Search, Loader2, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { Startup } from '../../types';

interface AdminListingsTabProps {
  listingsView: 'pending' | 'all';
  setListingsView: (view: 'pending' | 'all') => void;
  pendingStartups: Startup[];
  isLoadingPending: boolean;
  isUpdating: string | null;
  handleStatusChange: (id: string, newStatus: 'active' | 'rejected') => void;
  allListings: Startup[];
  isLoadingAllListings: boolean;
  isDeletingStartupId: string | null;
  handleDeleteStartup: (id: string, name: string) => void;
  listingsSearch: string;
  setListingsSearch: (val: string) => void;
  listingsSearchDebounceRef?: any;
  fetchAllListingsAdmin: (page?: number, search?: string) => void;
  totalAllListings?: number;
  allListingsPage: number;
  allListingsTotalPages: number;
  renderPagination: (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => React.ReactNode;
}

export const AdminListingsTab: React.FC<AdminListingsTabProps> = ({
  listingsView,
  setListingsView,
  pendingStartups,
  isLoadingPending,
  isUpdating,
  handleStatusChange,
  allListings,
  isLoadingAllListings,
  isDeletingStartupId,
  handleDeleteStartup,
  listingsSearch,
  setListingsSearch,
  fetchAllListingsAdmin,
  allListingsPage,
  allListingsTotalPages,
  renderPagination,
}) => {
  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="text-secondary w-5 h-5" />
            Platformadagi e'lonlar va arizalar boshqaruvi
          </h2>
          <p className="text-xs text-on-primary-container mt-0.5">
            Kutilayotgan arizalarni moderatsiya qilish yoki barcha mavjud e'lonlarni qidirish va o'chirish.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface-container p-1 rounded-xl border border-white/10 shrink-0">
          <button
            onClick={() => setListingsView('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-secondary/50 ${
              listingsView === 'pending'
                ? 'bg-secondary/20 text-secondary border border-secondary/30'
                : 'text-on-primary-container hover:text-white'
            }`}
          >
            Kutilayotganlar ({pendingStartups.length})
          </button>
          <button
            onClick={() => setListingsView('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-secondary/50 ${
              listingsView === 'all'
                ? 'bg-secondary/20 text-secondary border border-secondary/30'
                : 'text-on-primary-container hover:text-white'
            }`}
          >
            Barcha e'lonlar
          </button>
        </div>
      </div>

      {listingsView === 'all' && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-primary-container w-4 h-4" />
          <input
            type="text"
            placeholder="E'lon nomi yoki ID bo'yicha qidirish..."
            value={listingsSearch}
            onChange={(e) => {
              setListingsSearch(e.target.value);
              fetchAllListingsAdmin(1, e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-white text-xs placeholder-on-primary-container/60 focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
      )}

      {listingsView === 'pending' ? (
        isLoadingPending ? (
          <div className="py-12 text-center text-on-primary-container">
            <Loader2 className="w-10 h-10 mx-auto opacity-40 animate-spin text-on-primary-container" />
          </div>
        ) : pendingStartups.length === 0 ? (
          <div className="py-12 text-center text-on-primary-container space-y-2">
            <CheckCircle className="w-10 h-10 mx-auto opacity-40 text-on-primary-container" />
            <p className="text-sm font-bold">Kutilayotgan arizalar yo'q!</p>
            <p className="text-xs">Barcha yuborilgan startaplar ko'rib chiqilgan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingStartups.map((startup) => (
              <div
                key={startup.id}
                className="bg-surface-container-low border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={startup.image}
                    alt={`${startup.name} muqovasi`}
                    className="w-16 h-16 rounded-2xl object-cover border border-white/10 flex-shrink-0"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    width={64}
                    height={64}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-extrabold text-base">{startup.name}</h3>
                      <span className="bg-yellow-500/10 text-yellow-500 text-xs font-extrabold uppercase px-2 py-0.5 rounded-lg border border-yellow-500/20">
                        {startup.category}
                      </span>
                    </div>
                    <p className="text-xs text-secondary font-mono font-bold">
                      Sotish narxi: ${startup.price ? startup.price.toLocaleString() : "0"} • Turi: {startup.listingType}
                    </p>
                    <p className="text-xs text-on-primary-container leading-relaxed line-clamp-1">
                      {startup.slogan}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                  <button
                    disabled={isUpdating !== null}
                    onClick={() => handleStatusChange(startup.id, 'active')}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-success hover:brightness-110 disabled:opacity-50 text-on-secondary font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 shadow-lg shadow-success/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-success"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Tasdiqlash
                  </button>
                  <button
                    disabled={isUpdating !== null}
                    onClick={() => handleStatusChange(startup.id, 'rejected')}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <XCircle className="w-4 h-4" />
                    Rad etish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : isLoadingAllListings ? (
        <div className="py-12 text-center text-on-primary-container">
          <Loader2 className="w-10 h-10 mx-auto opacity-40 animate-spin text-on-primary-container" />
        </div>
      ) : allListings.length === 0 ? (
        <div className="py-12 text-center text-on-primary-container space-y-2">
          <Search className="w-10 h-10 mx-auto opacity-40 text-on-primary-container" />
          <p className="text-sm font-bold">Hech qanday e'lon topilmadi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allListings.map((startup) => (
            <div
              key={startup.id}
              className="bg-surface-container-low border border-white/5 hover:border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <img
                  src={startup.image}
                  alt={`${startup.name} - loyiha muqovasi`}
                  className="w-12 h-12 rounded-xl object-cover border border-white/5 flex-shrink-0"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  width={48}
                  height={48}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-extrabold text-sm truncate">{startup.name}</h3>
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-lg border ${
                      startup.status === 'active'
                        ? 'bg-success-container/10 text-success border-success/20'
                        : startup.status === 'pending'
                        ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {startup.status}
                    </span>
                  </div>
                  <p className="text-xs text-on-primary-container font-mono truncate">ID: {startup.id}</p>
                </div>
              </div>

              <button
                disabled={isDeletingStartupId !== null}
                onClick={() => handleDeleteStartup(startup.id, startup.name)}
                className="w-full md:w-auto px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white disabled:opacity-50 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingStartupId === startup.id ? "O'chirilmoqda..." : "Butunlay o'chirish"}
              </button>
            </div>
          ))}
        </div>
      )}
      {listingsView === 'all' && !isLoadingAllListings &&
        renderPagination(allListingsPage, allListingsTotalPages, (page) => fetchAllListingsAdmin(page, listingsSearch))}
    </div>
  );
};
