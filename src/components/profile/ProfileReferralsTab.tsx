import React from 'react';

interface ProfileReferralsTabProps {
  user?: any;
  referralStats: {
    referralCount: number;
    totalEarned: number;
    tier: any;
    referrals: any[];
  };
  handleGenerateReferral?: () => void;
  isGeneratingReferral?: boolean;
  copiedCode?: boolean;
  setCopiedCode?: (val: boolean) => void;
  onActionToast?: (msg: string) => void;
}

export const ProfileReferralsTab: React.FC<ProfileReferralsTabProps> = ({
  referralStats,
  handleGenerateReferral,
  isGeneratingReferral,
  copiedCode,
  setCopiedCode,
}) => {
  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
      <div className="border-b border-white/5 pb-4 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">share</span>
            Referral Dasturi (Do'stlaringizni taklif qiling)
          </h2>
          <p className="text-xs text-on-primary-container mt-0.5">
            Har bir taklif qilingan foydalanuvchi xarididan komissiya oling va darajangizni oshiring.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container border border-white/5 p-5 rounded-2xl space-y-1">
          <span className="text-xs text-on-primary-container uppercase font-bold">Joriy Daraja</span>
          <p className="text-xl font-black text-white">{referralStats.tier?.badge || 'Yangi'}</p>
          <p className="text-xs text-success font-bold">Komissiya: {referralStats.tier?.commission}%</p>
        </div>
        <div className="bg-surface-container border border-white/5 p-5 rounded-2xl space-y-1">
          <span className="text-xs text-on-primary-container uppercase font-bold">Takliflar Soni</span>
          <p className="text-3xl font-black text-white">{referralStats.referralCount}</p>
        </div>
        <div className="bg-surface-container border border-white/5 p-5 rounded-2xl space-y-1">
          <span className="text-xs text-on-primary-container uppercase font-bold">Ishlab Topilgan</span>
          <p className="text-3xl font-black text-white">${referralStats.totalEarned.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white/2 border border-white/5 rounded-2xl p-5 space-y-4">
        <h4 className="font-bold text-white text-sm">Sizning shaxsiy referral havolangiz</h4>
        <p className="text-xs text-on-primary-container leading-relaxed">
          Sizning referral kodingiz orqali xarid qilgan foydalanuvchilar <b>{referralStats.tier?.discount || 5}% chegirma</b> oladi, siz esa xarid summasidan <b>{referralStats.tier?.commission || 5}% mukofot</b> olasiz.
        </p>

        {!referralStats.referrals.length ? (
          <button
            onClick={() => handleGenerateReferral?.()}
            disabled={isGeneratingReferral}
            className="px-6 py-3 bg-secondary hover:brightness-110 text-on-secondary font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
          >
            <span className="material-symbols-outlined text-sm">bolt</span>
            {isGeneratingReferral ? "Yaratilmoqda..." : "Referral Kod Yaratish"}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/browse?ref=${referralStats.referrals[0].code}`}
                className="bg-surface-container border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-mono flex-1 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/browse?ref=${referralStats.referrals[0].code}`);
                  setCopiedCode?.(true);
                  setTimeout(() => setCopiedCode?.(false), 2000);
                }}
                className="px-5 py-2.5 bg-secondary hover:brightness-110 text-on-secondary font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
              >
                <span className="material-symbols-outlined text-sm">{copiedCode ? "done" : "content_copy"}</span>
                {copiedCode ? "Nusxalandi!" : "Havolani nusxalash"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
