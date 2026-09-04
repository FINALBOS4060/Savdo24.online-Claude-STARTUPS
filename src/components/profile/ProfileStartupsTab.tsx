import React from 'react';
import { Startup } from '../../types';
import { TerminalSquare, Leaf, Gamepad2, Rocket, ArrowUpToLine, ArrowRight, Plus } from 'lucide-react';

interface ProfileStartupsTabProps {
  myStartups: Startup[];
  handleCardClick: (id: string) => void;
  setView: (view: string, id?: string) => void;
  setTopModal: (state: { isOpen: boolean; startupId: string | null; startupName: string }) => void;
}

export const ProfileStartupsTab: React.FC<ProfileStartupsTabProps> = ({
  myStartups,
  handleCardClick,
  setView,
  setTopModal,
}) => {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {myStartups.map((startup) => {
        const isActive = startup.status === 'active';
        const isPending = startup.status === 'pending';
        const isSold = startup.soldStatus === 'sotildi';

        const statusClass = isActive && !isSold
          ? 'status-chip-active'
          : isPending
          ? 'status-chip-pending'
          : 'status-chip-sold';

        const statusLabel = isActive && !isSold
          ? 'Faol'
          : isPending
          ? 'Tekshirilmoqda'
          : 'Sotildi';

        const CategoryIcon =
          startup.category === 'Fintech'
            ? TerminalSquare
            : startup.category === 'Logistics'
            ? Leaf
            : startup.category === 'E-commerce'
            ? Gamepad2
            : Rocket;

        return (
          <div
            key={startup.id}
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick(startup.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick(startup.id);
              }
            }}
            className={`glass-card rounded-2xl p-6 hover:shadow-2xl transition-all duration-300 group border border-outline-variant/10 flex flex-col justify-between min-h-[320px] focus:outline-none focus:ring-2 focus:ring-secondary-container ${
              isSold ? 'opacity-70 hover:opacity-100 grayscale hover:grayscale-0' : 'cursor-pointer hover:-translate-y-1'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-secondary-fixed/10 flex items-center justify-center border border-secondary-fixed/20 text-secondary-container">
                  <CategoryIcon className="w-6 h-6" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>

              <h3 className="text-xl font-extrabold mb-2 group-hover:text-secondary-container transition-colors text-on-primary-container flex items-center gap-2">
                {startup.name}
                {startup.isTop && (
                  <span className="text-xs bg-secondary/20 text-secondary px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                    <ArrowUpToLine className="w-3 h-3" />
                    TOP
                  </span>
                )}
              </h3>
              
              <p className="text-xs text-on-primary-container line-clamp-3 leading-relaxed mb-6">
                {startup.description}
              </p>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="text-xs uppercase tracking-wider text-on-tertiary-container font-extrabold mb-1">
                    Sotish narxi
                  </p>
                  <p className="font-mono text-xs font-bold text-on-primary-container">${startup.price ? startup.price.toLocaleString() : "0"}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="text-xs uppercase tracking-wider text-on-tertiary-container font-extrabold mb-1">
                    E'lon turi
                  </p>
                  <p className="font-mono text-xs font-bold text-on-primary-container leading-tight">{startup.listingType || "To'liq loyiha (manba kodi bilan)"}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5 gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setView('edit-startup', startup.id);
                  }}
                  className="flex-1 py-2 bg-blue-400/10 border border-blue-400/30 hover:bg-blue-400/20 text-blue-400 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  Tahrirlash
                </button>
                {isActive ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTopModal({ isOpen: true, startupId: startup.id, startupName: startup.name });
                      }}
                      className="flex-1 py-2 bg-secondary/10 border border-secondary/30 hover:bg-secondary/20 text-secondary rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowUpToLine className="w-3 h-3" />
                      TOP qilish
                    </button>
                  </>
                ) : isPending ? (
                  <>
                    <span className="text-xs text-on-tertiary-container italic">Tekshirilmoqda...</span>
                    <span className="text-xs font-bold text-on-primary-container">Taxminan 24 soat</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold text-secondary-container">Muvaffaqiyatli chiqish</span>
                    <ArrowRight className="w-4 h-4 text-on-primary-container" />
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div
        role="button"
        tabIndex={0}
        onClick={() => setView('sell')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setView('sell');
          }
        }}
        className="border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center p-8 hover:bg-white/5 hover:border-secondary-container/50 transition-all group cursor-pointer min-h-[320px] text-center focus:outline-none focus:ring-2 focus:ring-secondary-container"
      >
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-secondary-container/10 transition-all">
          <Plus className="w-8 h-8 text-secondary-container group-hover:rotate-90 transition-transform duration-300" />
        </div>
        <h4 className="text-lg font-bold text-on-primary-container mb-2 group-hover:text-secondary-container transition-colors">
          Yangi e'lon
        </h4>
        <p className="text-xs text-on-primary-container max-w-[200px] leading-relaxed">
          Loyihangizni 5000 dan ortiq tasdiqlangan xaridorlarga taqdim eting.
        </p>
      </div>
    </section>
  );
};
