import React from 'react';
import { Startup, Category } from '../../types';

interface DetailSidebarProps {
  startup: Startup;
  categories: Category[];
  isOwnListing: boolean;
  isBookmarked: boolean;
  handlePurchaseClick: () => void;
  toggleBookmark: (id: string) => void;
  onActionToast: (message: string) => void;
  handleOpenReportModal: (type: 'startup' | 'idea' | 'user', id: string) => void;
  sellerReviewsData: any;
  hasPurchased: boolean;
  setIsReviewModalOpen: (val: boolean) => void;
  setIsDisputeModalOpen: (val: boolean) => void;
}

export const DetailSidebar: React.FC<DetailSidebarProps> = ({
  startup,
  categories,
  isOwnListing,
  isBookmarked,
  handlePurchaseClick,
  toggleBookmark,
  onActionToast,
  handleOpenReportModal,
  sellerReviewsData,
  hasPurchased,
  setIsReviewModalOpen,
  setIsDisputeModalOpen,
}) => {
  return (
    <aside className="lg:sticky lg:top-24 space-y-6">
      <div className="p-6 bg-[#0e1726]/95 border border-outline-variant/20 rounded-2xl shadow-xl space-y-6">
        <div>
          <span className="text-[10px] text-on-primary-container uppercase font-extrabold tracking-wider block mb-1">
            Sotish narxi
          </span>
          <div className="text-3xl md:text-4xl font-black font-mono text-[#f3ba2f] tracking-tight">
            ${startup.price ? startup.price.toLocaleString() : "Kelishilgan holda"}
          </div>
        </div>

        <div className="space-y-3">
          {/* Primary "Sotib olish" Button */}
          <button
            onClick={handlePurchaseClick}
            disabled={startup.soldStatus === 'sotildi' || isOwnListing}
            className="w-full py-4 bg-[#f3ba2f] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 text-[#12161c] font-black text-sm rounded-xl active:scale-95 transition-all shadow-lg shadow-yellow-500/10 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">shopping_cart</span>
            {startup.soldStatus === 'sotildi' ? "Sotilgan (Band qilingan)" : isOwnListing ? "Bu sizning e'loningiz" : "Loyihani sotib olish"}
          </button>

          {/* Demo URL Button */}
          {startup.demoUrl && (
            <a
              href={startup.demoUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                try {
                  const url = new URL(startup.demoUrl!);
                  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    e.preventDefault();
                  }
                } catch {
                  e.preventDefault();
                }
              }}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-95 text-center uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Demoni ko'rish
            </a>
          )}

          {/* GitHub repo havolasi */}
          {startup.githubUrl && (
            <a
              href={startup.githubUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                try {
                  const url = new URL(startup.githubUrl!);
                  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    e.preventDefault();
                  }
                } catch {
                  e.preventDefault();
                }
              }}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-95 text-center uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-sm">code</span>
              Repozitoriyani ko'rish
            </a>
          )}

          {/* Bookmark Button */}
          <button
            onClick={() => {
              toggleBookmark(startup.id);
              onActionToast(
                isBookmarked
                  ? `${startup.name} xatcho'plardan olib tashlandi.`
                  : `${startup.name} xatcho'plarga qo'shildi!`
              );
            }}
            className="w-full py-3 border border-white/10 hover:bg-white/5 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wider cursor-pointer"
          >
            <span
              className="material-symbols-outlined text-base leading-none"
              style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
            >
              bookmark
            </span>
            <span>{isBookmarked ? "Saqlab qo'yilgan" : "Saqlab qo'yish"}</span>
          </button>

          {/* Report Button */}
          <button
            onClick={() => handleOpenReportModal('startup', startup.id)}
            className="w-full py-3 border border-red-500/30 hover:bg-red-500/10 text-red-400 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wider cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-red-500">
              flag
            </span>
            <span>🚩 Shikoyat qilish</span>
          </button>
        </div>

        {/* Details in small font */}
        <div className="border-t border-white/5 pt-4 space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-on-primary-container font-medium">Kategoriya</span>
            <span className="text-white font-semibold">{categories.find(c => c.id === startup.category)?.name || startup.category}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-on-primary-container font-medium">E'lon turi</span>
            <span className="text-white font-semibold">{startup.listingType || "To'liq loyiha (manba kodi bilan)"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-on-primary-container font-medium">Manba kodi (Repo)</span>
            <span className="text-white font-semibold">{startup.repoIncluded ? "Kiritilgan ✅" : "Mavjud emas ❌"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-on-primary-container font-medium">Sotuv holati</span>
            <span>
              {startup.soldStatus === 'sotildi' ? (
                <span className="text-red-500 font-extrabold flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Sotildi
                </span>
              ) : (
                <span className="text-green-500 font-extrabold flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Sotuvda
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Tech Stack Chips Block */}
        {startup.techStack && startup.techStack.length > 0 && (
          <div className="border-t border-white/5 pt-4 space-y-2.5">
            <span className="text-[10px] text-on-primary-container uppercase font-extrabold tracking-wider block">
              Texnologiyalar
            </span>
            <div className="flex flex-wrap gap-1.5">
              {startup.techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-[#f3ba2f] flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 bg-[#f3ba2f] rounded-full"></span>
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sotuvchi va Reyting */}
      {startup.userId && (
        <div className="p-6 bg-[#0e1726]/95 border border-outline-variant/20 rounded-2xl shadow-xl space-y-4">
          <span className="text-[10px] text-on-primary-container uppercase font-extrabold tracking-wider block">
            Sotuvchi ma'lumotlari
          </span>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary-container font-black text-lg border border-secondary-container/20">
              {sellerReviewsData?.sellerName ? sellerReviewsData.sellerName[0].toUpperCase() : "S"}
            </div>
            <div>
              <h4 className="text-white font-extrabold text-sm">
                {sellerReviewsData?.sellerName || "Sotuvchi"}
              </h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="material-symbols-outlined text-[#f3ba2f] text-sm fill-1">star</span>
                <span className="text-white text-xs font-bold font-mono">
                  {sellerReviewsData?.averageRating || "0.0"}
                </span>
                <span className="text-on-primary-container text-[11px]">
                  ({sellerReviewsData?.totalReviews || 0} sharh)
                </span>
              </div>
            </div>
          </div>

          {/* Show "Sharh qoldirish" and "Nizo ochish" if purchased */}
          {hasPurchased && (
            <div className="border-t border-white/5 pt-4 space-y-2">
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="w-full py-2.5 bg-secondary-container/10 hover:bg-secondary-container/20 border border-secondary-container/30 text-secondary-container rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">rate_review</span>
                Sharh qoldirish
              </button>
              <button
                onClick={() => setIsDisputeModalOpen(true)}
                className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">gavel</span>
                Nizo ochish
              </button>
            </div>
          )}

          {!isOwnListing && (
            <button
              onClick={() => handleOpenReportModal('user', String(startup.userId))}
              className="w-full py-2.5 border-t border-white/5 pt-4 mt-2 hover:text-red-400 text-on-primary-container text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">flag</span>
              Sotuvchini shikoyat qilish
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
