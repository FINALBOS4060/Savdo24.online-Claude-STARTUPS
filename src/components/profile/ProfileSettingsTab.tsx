import React from 'react';

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
  generateLinkCode: () => void;
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
  generateLinkCode,
}) => {
  return (
    <section className="max-w-xl bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <h3 className="text-lg font-bold text-white border-b border-outline-variant/15 pb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary-container">person</span>
          Profil sozlamalarini tahrirlash
        </h3>

        <div className="flex flex-col items-center gap-4 py-4">
          <div 
            className="relative group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-24 h-24 rounded-full border-4 border-secondary-container/20 overflow-hidden bg-[#0b1426] flex items-center justify-center">
              {isUploadingAvatar ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-secondary-container border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] font-bold text-secondary-container">Yuklanmoqda...</span>
                </div>
              ) : (
                <img 
                  src={editAvatar} 
                  alt="Profil rasmini yangilash - yangi rasm tanlash" 
                  className="w-full h-full object-cover group-hover:opacity-50 transition-all" 
                  loading="lazy"
                  width={96}
                  height={96}
                />
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
              <span className="material-symbols-outlined text-white text-3xl">edit</span>
            </div>
            {user.isVip && (
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-black border-4 border-primary-container shadow-lg">
                <span className="material-symbols-outlined text-lg">workspace_premium</span>
              </div>
            )}
          </div>
          <p className="text-[10px] font-bold text-on-primary-container uppercase tracking-widest">Profil rasmini o'zgartirish</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleAvatarUpload} 
            accept="image/*" 
            className="hidden" 
          />
          
          <div className="mt-4 pt-4 border-t border-outline-variant/10 w-full space-y-3">
            <p className="text-[10px] font-bold text-on-primary-container text-center uppercase tracking-widest">Yoki tayyor variantni tanlang</p>
            <div className="flex justify-center gap-3">
              {[
                '/default-avatar.jpg',
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff`,
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
              ].map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setEditAvatar(url)}
                  className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${
                    editAvatar === url ? 'border-secondary-container scale-110 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="Avatar variant" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-on-primary-container block">To'liq ism</label>
          <input
            type="text"
            className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-lg p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-all"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-on-primary-container block">Sotuvchi/Xaridor roli</label>
          <select
            className="w-full bg-[#0b1426] border border-outline-variant/30 text-white/50 rounded-lg p-3 font-semibold text-sm focus:outline-none appearance-none cursor-not-allowed"
            value={editRole}
            disabled
          >
            <option value="Xaridor">Xaridor</option>
            <option value="Sotuvchi">Sotuvchi</option>
          </select>
          <p className="text-[10px] text-on-primary-container">Xavfsizlik sababli rolni bu yerdan o'zgartirib bo'lmaydi. Sotuvchi bo'lish uchun shunchaki birinchi e'loningizni joylashtiring.</p>
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
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary-container text-lg">robot_2</span>
          Telegram botni ulash
        </h4>
        <p className="text-xs text-on-primary-container leading-relaxed">
          Botni ulash orqali siz mahsulotlarni bevosita Telegram orqali sotib olishingiz va to'lovdan so'ng darhol yetkazish havolasini olishingiz mumkin.
        </p>
        
        {linkCode ? (
          <div className="bg-[#0b1426] border border-secondary-container/30 rounded-xl p-4 text-center space-y-2 animate-pulse-subtle">
            <p className="text-[10px] uppercase font-bold text-on-primary-container">Sizning ulanish kodingiz:</p>
            <p className="text-2xl font-mono font-bold text-secondary-container tracking-widest">{linkCode}</p>
            <p className="text-[10px] text-on-primary-container">
              Botga o'ting va ushbu buyruqni yuboring: <br/>
              <code className="bg-white/5 px-1 py-0.5 rounded">/bogla {linkCode}</code>
            </p>
          </div>
        ) : (
          <button
            onClick={generateLinkCode}
            className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">link</span>
            Ulanish kodi olish
          </button>
        )}
      </div>
    </section>
  );
};
