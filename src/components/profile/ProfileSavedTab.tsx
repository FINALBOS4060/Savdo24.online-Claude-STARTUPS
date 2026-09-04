import React from 'react';
import { Bookmark } from 'lucide-react';
import { Startup, Category } from '../../types';

interface ProfileSavedTabProps {
  savedStartups: Startup[];
  categories: Category[];
  handleCardClick: (id: string) => void;
  setView: (view: string) => void;
}

export const ProfileSavedTab: React.FC<ProfileSavedTabProps> = ({
  savedStartups,
  categories,
  handleCardClick,
  setView,
}) => {
  return (
    <section className="space-y-6">
      {savedStartups.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-outline-variant/20 rounded-2xl bg-white/5">
          <Bookmark className="w-10 h-10 text-on-primary-container mb-3" />
          <p className="text-on-primary-container font-semibold">Hozircha saqlangan e'lonlar yo'q.</p>
          <button
            onClick={() => setView('browse')}
            className="text-secondary-container font-bold text-sm underline mt-2 cursor-pointer"
          >
            Xatcho'p qo'shish uchun startaplarni ko'rib chiqing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {savedStartups.map((startup) => (
            <div
              key={startup.id}
              className="bg-primary-container border border-outline-variant/20 rounded-2xl overflow-hidden hover:shadow-xl transition-all group flex flex-col justify-between h-[380px]"
            >
              <div className="h-40 relative overflow-hidden bg-white/5">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  src={startup.image}
                  alt={`${startup.name} - saqlangan loyiha muqovasi`}
                  loading="lazy"
                  width={320}
                  height={160}
                />
                <div className="absolute top-4 left-4 bg-primary-container/95 text-on-primary-container border border-white/10 px-3 py-1 rounded-lg text-xs font-bold uppercase">
                  {categories.find(c => c.id === startup.category)?.name || startup.category}
                </div>
              </div>

              <div className="p-5 flex-grow flex flex-col justify-between">
                <div>
                  <h4
                    onClick={() => handleCardClick(startup.id)}
                    className="font-extrabold text-on-primary-container text-base hover:text-secondary-container transition-colors cursor-pointer"
                  >
                    {startup.name}
                  </h4>
                  <p className="text-xs text-on-primary-container line-clamp-2 mt-1">
                    {startup.description}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-on-primary-container uppercase block">Sotish narxi</span>
                    <span className="text-sm font-bold text-secondary-container font-mono">
                      ${startup.price ? startup.price.toLocaleString() : "Kelishilgan holda"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCardClick(startup.id)}
                    className="px-4 py-2 bg-white/5 hover:bg-secondary-container hover:text-on-secondary-fixed text-on-primary-container font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Ko'rish
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
