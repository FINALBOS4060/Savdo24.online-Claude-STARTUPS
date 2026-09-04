import React, { useState } from 'react';
import { User, Pencil, Award, Bot, Link2, ExternalLink, CheckCircle2, Unlink, BellOff } from 'lucide-react';
import { telegramLinkDeepLink } from '../../lib/constants';

interface ProfileSettingsTabProps {
  handleSaveSettings: (e: React.FormEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploadingAvatar: boolean;
  editAvatar: string;
  setEditAvatar: (url: string) => void;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  user: any;
  editName: string;
  setEditName: (name: string) => void;
  editRole: string;
  isSavingSettings: boolean;
  linkCode: string | null;
  linkCodeSecondsLeft?: number;
  generateLinkCode: () => void;
  onToggleTelegramBroadcastOptOut?: (optOut: boolean) => void;
}

export const ProfileSettingsTab: React.FC<ProfileSettingsTabProps> = ({
  handleSaveSettings,
  fileInputRef,
  isUploadingAvatar,
  editAvatar,
  setEditAvatar,
  handleAvatarUpload,
  user,
  editName,
  setEditName,
  editRole,
  isSavingSettings,
  linkCode,
  linkCodeSecondsLeft = 0,
  generateLinkCode,
  onToggleTelegramBroadcastOptOut,
}) => {
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isSavingNotifPref, setIsSavingNotifPref] = useState(false);

  // 1-so'rov: "Bildirishnomalarni boshqarish (opt-out)". Faqat reklama/
  // broadcast xabarlaridan chiqish — xarid/nizo kabi muhim xabarlar doim keladi.
  const handleToggleBroadcastOptOut = async () => {
    if (!onToggleTelegramBroadcastOptOut) return;
    setIsSavingNotifPref(true);
    try {
      await onToggleTelegramBroadcastOptOut(!user?.telegramBroadcastOptOut);
    } finally {
      setIsSavingNotifPref(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!window.confirm("Telegram hisobingizni uzmoqchimisiz? Bot orqali xarid qilish, obuna almashish va boshqa Telegram funksiyalari o'chadi.")) {
      return;
    }
    setIsUnlinking(true);
    try {
      const res = await fetch('/api/telegram/unlink', { method: 'POST' });
      if (res.ok) {
        window.location.reload();
      } else {
        setIsUnlinking(false);
      }
    } catch {
      setIsUnlinking(false);
    }
  };

  return (
    <section className="max-w-xl bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <h3 className="text-lg font-bold text-on-primary-container border-b border-outline-variant/15 pb-3 flex items-center gap-2">
          <User className="w-6 h-6 text-secondary-container" />
          Profil sozlamalarini tahrirlash
        </h3>

        <div className="flex flex-col items-center gap-4 py-4">
          <div
            role="button"
            tabIndex={0}
            className="relative group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-container rounded-full"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="w-24 h-24 rounded-full border-4 border-secondary-container/20 overflow-hidden bg-background flex items-center justify-center">
              {isUploadingAvatar ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-secondary-container border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-secondary-container">Yuklanmoqda...</span>
                </div>
              ) : (
                <img 
                  src={editAvatar} 
                  alt="Profil rasmini yangilash - yangi rasm tanlash" 
                  className="w-full h-full object-cover group-hover:opacity-50 transition-all" 
                  loading="lazy"
                  width={96}
                  height={96}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.dataset.fallback) return;
                    img.dataset.fallback = '1';
                    img.src = '/default-avatar.svg';
                  }}
                />
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
              <Pencil className="w-8 h-8 text-on-primary-container" />
            </div>
            {user.isVip && (
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-on-secondary border-4 border-primary-container shadow-lg">
                <Award className="w-5 h-5" />
              </div>
            )}
          </div>
          <p className="text-xs font-bold text-on-primary-container uppercase tracking-widest">Profil rasmini o'zgartirish</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleAvatarUpload} 
            accept="image/*" 
            className="hidden" 
          />
          
          <div className="mt-4 pt-4 border-t border-outline-variant/10 w-full space-y-3">
            <p className="text-xs font-bold text-on-primary-container text-center uppercase tracking-widest">Yoki tayyor variantni tanlang</p>
            <div className="flex justify-center gap-3">
              {[
                '/default-avatar.svg',
                // MUHIM: avval bu yerda "ui-avatars.com" ishlatilgan edi, lekin
                // server CSP (Content-Security-Policy) sozlamasida faqat
                // "api.dicebear.com" ruxsat etilgan manbalar ro'yxatida bor —
                // ui-avatars.com'ga ruxsat berilmagani uchun brauzer bu
                // rasmlarni bloklab, o'rniga buzilgan rasm belgisini
                // ko'rsatardi. CSP'ni kengaytirish o'rniga, saytda allaqachon
                // (DetailPage'da) ishlatilayotgan va ruxsat etilgan
                // dicebear'ga o'tkazildi — yangi tashqi domenga ishonch
                // qo'shmasdan muammoni hal qiladi.
                `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}`,
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`,
              ].map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setEditAvatar(url)}
                  className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${
                    editAvatar === url ? 'border-secondary-container scale-110 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  <img
                    src={url}
                    alt="Avatar variant"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.dataset.fallback) return;
                      img.dataset.fallback = '1';
                      img.src = '/default-avatar.svg';
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-on-primary-container block">To'liq ism</label>
          <input
            type="text"
            className="w-full bg-background border border-outline-variant/30 text-on-primary-container rounded-lg p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-all"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-on-primary-container block">Sotuvchi/Xaridor roli</label>
          <select
            className="w-full bg-background border border-outline-variant/30 text-on-primary-container/50 rounded-lg p-3 font-semibold text-sm focus:outline-none appearance-none cursor-not-allowed"
            value={editRole}
            disabled
          >
            <option value="Xaridor">Xaridor</option>
            <option value="Sotuvchi">Sotuvchi</option>
          </select>
          <p className="text-xs text-on-primary-container">Xavfsizlik sababli rolni bu yerdan o'zgartirib bo'lmaydi. Sotuvchi bo'lish uchun shunchaki birinchi e'loningizni joylashtiring.</p>
        </div>

        <button
          type="submit"
          disabled={isSavingSettings}
          className="w-full py-3 bg-secondary-container text-on-secondary-fixed rounded-xl font-bold text-sm shadow-lg shadow-secondary-container/10 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSavingSettings ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
        </button>
      </form>

      <div className="mt-10 pt-6 border-t border-outline-variant/15 space-y-4">
        <h4 className="text-sm font-bold text-on-primary-container flex items-center gap-2">
          <Bot className="w-5 h-5 text-secondary-container" />
          Telegram botni ulash
        </h4>
        <p className="text-xs text-on-primary-container leading-relaxed">
          Botni ulash orqali siz mahsulotlarni bevosita Telegram orqali sotib olishingiz va to'lovdan so'ng darhol yetkazish havolasini olishingiz mumkin.
        </p>
        
        {user?.telegramLinked ? (
          <div className="bg-background border border-success/30 rounded-xl p-4 space-y-3">
            <p className="flex items-center gap-2 text-sm font-bold text-success">
              <CheckCircle2 className="w-4 h-4" /> Telegram hisobingiz ulangan
            </p>
            <p className="text-xs text-on-primary-container/70">
              Botdagi barcha funksiyalar (xarid, obuna almashish va h.k.) faol.
            </p>

            <div className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <BellOff className="w-4 h-4 text-on-primary-container/70 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-on-primary-container">Reklama xabarlarini o'chirish</p>
                  <p className="text-[11px] text-on-primary-container/60">
                    Xarid, nizo kabi muhim xabarlar baribir keladi — faqat umumiy reklama/e'lon xabarlaridan chiqasiz.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!user?.telegramBroadcastOptOut}
                onClick={handleToggleBroadcastOptOut}
                disabled={isSavingNotifPref || !onToggleTelegramBroadcastOptOut}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${
                  user?.telegramBroadcastOptOut ? 'bg-secondary-container' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    user?.telegramBroadcastOptOut ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleUnlinkTelegram}
              disabled={isUnlinking}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Unlink className="w-4 h-4" />
              {isUnlinking ? 'Uzilmoqda...' : 'Ulanishni uzish'}
            </button>
          </div>
        ) : linkCode ? (
          <div className="bg-background border border-secondary-container/30 rounded-xl p-4 text-center space-y-3 animate-pulse-subtle">
            <p className="text-xs uppercase font-bold text-on-primary-container">Sizning ulanish kodingiz:</p>
            <p className="text-2xl font-mono font-bold text-secondary-container tracking-widest">{linkCode}</p>
            <p className="text-xs text-on-primary-container/70 font-mono">
              ⏱ Muddati: <span className="font-bold text-secondary-container">{String(Math.floor(linkCodeSecondsLeft / 60)).padStart(2, '0')}:{String(linkCodeSecondsLeft % 60).padStart(2, '0')}</span>
            </p>
            {/* MUHIM: avval faqat kodni ko'rsatib, "botga o'ting" deyilardi —
                lekin botning aniq havolasi hech qayerda ko'rsatilmagan edi,
                foydalanuvchi uni Telegram'da qo'lda qidirishi kerak edi. Endi
                pastdagi tugma bevosita botni ochadi VA kodni avtomatik
                yuboradi (deep-link) — foydalanuvchi hech narsa yozmasdan,
                bitta bosish bilan hisobini ulaydi. */}
            <a
              href={telegramLinkDeepLink(linkCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-secondary-container text-on-secondary-fixed rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-95"
            >
              <Bot className="w-4 h-4" />
              Botni ochish va avtomatik ulash
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <p className="text-xs text-on-primary-container">
              Yoki botda qo'lda yozing: <br/>
              <code className="bg-white/5 px-1 py-0.5 rounded">/bogla {linkCode}</code>
            </p>
            <p className="text-xs text-on-primary-container/60">⏱ Kod 15 daqiqa amal qiladi.</p>
          </div>
        ) : (
          <button
            onClick={generateLinkCode}
            className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-on-primary-container rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Link2 className="w-4 h-4" />
            Ulanish kodi olish
          </button>
        )}
      </div>
    </section>
  );
};
