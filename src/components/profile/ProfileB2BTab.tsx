import React from 'react';

interface ProfileB2BTabProps {
  b2bAccount: any;
  setB2BAccount: React.Dispatch<React.SetStateAction<any>>;
  onActionToast: (message: string) => void;
  isSubmittingB2B: boolean;
  setIsSubmittingB2B: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ProfileB2BTab: React.FC<ProfileB2BTabProps> = ({
  b2bAccount,
  setB2BAccount,
  onActionToast,
  isSubmittingB2B,
  setIsSubmittingB2B,
}) => {
  return (
    <section className="space-y-8 animate-fade-in">
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-8 text-center space-y-6">
        <span className="material-symbols-outlined text-6xl text-blue-400">corporate_fare</span>
        <h3 className="text-2xl font-black text-white">Savdo24 B2B — Kompaniyalar uchun maxsus imkoniyatlar</h3>
        <p className="text-on-primary-container max-w-2xl mx-auto text-sm leading-relaxed">
          B2B hisob orqali siz ulgurji xaridorlar uchun <b>20% gacha chegirma</b>, korporativ hisob-faktura va 
          shaxsiy menejer xizmatlaridan foydalanishingiz mumkin.
        </p>

        {b2bAccount ? (
          <div className="bg-[#0b1426] border border-outline-variant/20 rounded-2xl p-6 text-left max-w-xl mx-auto space-y-4">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-on-primary-container text-xs font-bold uppercase">Kompaniya:</span>
              <span className="text-white font-bold">{b2bAccount.companyName}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-on-primary-container text-xs font-bold uppercase">Holati:</span>
              <span className={`text-xs font-black uppercase ${b2bAccount.verified ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {b2bAccount.verified ? 'Tasdiqlangan' : 'Tekshirilmoqda'}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-on-primary-container text-xs font-bold uppercase">Ulgurji chegirma:</span>
              <span className="text-blue-400 font-bold">{b2bAccount.discount}%</span>
            </div>
          </div>
        ) : (
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (isSubmittingB2B) return;
              setIsSubmittingB2B(true);
              const formData = new FormData(e.currentTarget);
              try {
                const res = await fetch('/api/b2b/onboard', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    companyName: formData.get('companyName'),
                    taxId: formData.get('taxId')
                  })
                });
                if (res.ok) {
                  const data = await res.json();
                  setB2BAccount(data);
                  onActionToast("B2B so'rovingiz qabul qilindi!");
                } else {
                  const err = await res.json().catch(() => ({}));
                  onActionToast(err.error || "B2B so'rovini yuborishda xatolik yuz berdi.");
                }
              } catch (err) {
                console.error("B2B onboard error:", err);
                onActionToast("Tarmoq xatosi yuz berdi.");
              } finally {
                setIsSubmittingB2B(false);
              }
            }}
            className="max-w-md mx-auto space-y-4 bg-[#0b1426] p-8 rounded-2xl border border-outline-variant/20"
          >
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-on-primary-container uppercase">Kompaniya nomi</label>
              <input name="companyName" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-400" placeholder="MCHJ ..." />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-on-primary-container uppercase">STIR (INN) / Soliq ID</label>
              <input name="taxId" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-400" placeholder="123456789" />
            </div>
            <button
              type="submit"
              disabled={isSubmittingB2B}
              className="w-full py-4 bg-blue-500 text-black font-black rounded-xl hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingB2B ? 'Yuborilmoqda...' : "B2B a'zolik so'rovini yuborish"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};
