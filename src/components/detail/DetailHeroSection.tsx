import React from 'react';
import { ArrowUpCircle, MessageSquare, Image } from 'lucide-react';
import { Startup } from '../../types';

interface DetailHeroSectionProps {
  startup: Startup;
  handleContactSeller: () => void;
}

export const DetailHeroSection: React.FC<DetailHeroSectionProps> = ({
  startup,
  handleContactSeller,
}) => {
  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[500px]">
      <div className="md:col-span-2 md:row-span-2 relative overflow-hidden rounded-2xl border border-outline-variant/30 group">
        <img
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
          src={startup.image}
          alt={`${startup.name} - asosiy startap rasmi`}
          loading="lazy"
          width={600}
          height={500}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-container via-primary-container/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full p-6">
          <span className="px-3 py-1 bg-secondary-container text-on-secondary-fixed text-xs font-bold rounded-full mb-3 inline-block uppercase tracking-wider">
            {startup.slogan}
          </span>
          <h1 className="text-white font-extrabold text-2xl md:text-4xl mb-2 flex items-center gap-3">
            {startup.name}
            {startup.isTop && (
              <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                <ArrowUpCircle className="w-3.5 h-3.5 text-xs" />
                TOP
              </span>
            )}
          </h1>
          <p className="text-on-primary-container text-xs md:text-sm max-w-md leading-relaxed">
            {startup.description}
          </p>
          <button
            onClick={handleContactSeller}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            💬 Sotuvchi bilan bog'lanish
          </button>
        </div>
      </div>

      {/* Dynamic / pre-filled auxiliary gallery slots */}
      {startup.gallery && startup.gallery[0] ? (
        <div className="hidden md:block relative overflow-hidden rounded-2xl border border-outline-variant/30 group">
          <img
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            src={startup.gallery[0]}
            alt={`${startup.name} - qo'shimcha galereya rasmi 1`}
            loading="lazy"
            width={280}
            height={240}
          />
        </div>
      ) : (
        <div className="hidden md:block bg-white/5 border border-dashed border-outline-variant/30 rounded-2xl flex items-center justify-center text-on-primary-container">
          <Image className="w-8 h-8 text-on-primary-container" />
        </div>
      )}

      {startup.gallery && startup.gallery[1] ? (
        <div className="hidden md:block relative overflow-hidden rounded-2xl border border-outline-variant/30 group">
          <img
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            src={startup.gallery[1]}
            alt={`${startup.name} - qo'shimcha galereya rasmi 2`}
            loading="lazy"
            width={280}
            height={240}
          />
        </div>
      ) : (
        <div className="hidden md:block bg-white/5 border border-dashed border-outline-variant/30 rounded-2xl flex items-center justify-center text-on-primary-container">
          <Image className="w-8 h-8 text-on-primary-container" />
        </div>
      )}

      {startup.gallery && startup.gallery[2] ? (
        <div className="hidden md:block md:col-span-2 relative overflow-hidden rounded-2xl border border-outline-variant/30 group">
          <img
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            src={startup.gallery[2]}
            alt={`${startup.name} - yordamchi banner muqovasi`}
            loading="lazy"
            width={580}
            height={240}
          />
        </div>
      ) : (
        <div className="hidden md:block md:col-span-2 bg-gradient-to-r from-secondary-container/10 to-transparent border border-outline-variant/30 rounded-2xl flex items-center justify-center text-secondary-container font-semibold">
          Startap media markazi
        </div>
      )}
    </section>
  );
};
