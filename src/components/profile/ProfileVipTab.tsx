import React from 'react';

interface ProfileVipTabProps {
  vipDays: number;
  setVipDays: (val: number) => void;
  vipDiscountPercent: number;
  vipEstimatedPrice: number;
  handleBuyVip: () => void;
  isBuyingVip: boolean;
}

export const ProfileVipTab: React.FC<ProfileVipTabProps> = ({
  vipDays,
  setVipDays,
  vipDiscountPercent,
  vipEstimatedPrice,
  handleBuyVip,
  isBuyingVip,
}) => {
  return (
    <section className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-yellow-400/10 border border-yellow-400/20 rounded-3xl mx-auto flex items-center justify-center text-yellow-400">
          <span className="material-symbols-outlined text-4xl">workspace_premium</span>
        </div>
        <h2 className="text-3xl font-black text-white">VIP A'zolik</h2>
        <p className="text-on-primary-container">
          Eksklyuziv imkoniyatlar va chegirmalarga ega bo'ling.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="glass-card p-6 rounded-2xl border-yellow-400/20 bg-yellow-400/5 relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">done</span>
                </span>
                <p className="text-sm text-white">Ismingiz yonida 👑 VIP belgisi</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">done</span>
                </span>
                <p className="text-sm text-white">Rasmlarni yuklashda 6MB gacha limit (oddiyda 2MB)</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">done</span>
                </span>
                <p className="text-sm text-white">Yangi loyihalarni birinchi bo'lib ko'rish imkoniyati</p>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] uppercase font-bold text-on-primary-container mb-1">Muddati tanlang (kun)</p>
                  <input 
                    type="number" 
                    value={vipDays} 
                    onChange={(e) => setVipDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-yellow-400/50 outline-none"
                  />
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-on-primary-container mb-1">Jami ({vipDiscountPercent}% chegirma bilan)</p>
                  <p className="text-3xl font-black text-yellow-400">
                    ${vipEstimatedPrice}
                  </p>
                </div>
              </div>

              <button 
                onClick={handleBuyVip}
                disabled={isBuyingVip}
                className="w-full py-4 bg-yellow-400 text-black font-black rounded-xl hover:brightness-110 transition-all shadow-lg shadow-yellow-400/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isBuyingVip ? 'Yuklanmoqda...' : "👑 VIP bo'lish"}
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-yellow-400/10 blur-[100px] rounded-full"></div>
        </div>
      </div>
    </section>
  );
};
