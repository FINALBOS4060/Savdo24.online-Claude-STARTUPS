import React from 'react';

interface AdminSettingsTabProps {
  isLoadingSettings: boolean;
  settings: any[];
  settingsValues: Record<string, string>;
  setSettingsValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  visibleSecrets: Record<string, boolean>;
  setVisibleSecrets: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  savingKey: string | null;
  handleSaveSetting: (key: string, value: string) => Promise<void>;
  settingsStatus: Record<string, string>;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  isLoadingSettings,
  settings,
  settingsValues,
  setSettingsValues,
  visibleSecrets,
  setVisibleSecrets,
  savingKey,
  handleSaveSetting,
  settingsStatus,
}) => {
  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-[#f0b90b]">settings</span>
          Tizim sozlamalari
        </h2>
        <p className="text-xs text-[#8892b0] mt-1">
          Telegram bot, to'lov xizmatlari va API kalitlarini boshqarish.
        </p>
      </div>

      {isLoadingSettings ? (
        <div className="py-12 text-center text-on-primary-container">
          <span className="animate-spin inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mb-2"></span>
          <p className="text-sm font-bold">Sozlamalar yuklanmoqda...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {settings.map((s) => {
            const key = typeof s === 'string' ? s : s.key;
            const isSecret = key.includes('TOKEN') || key.includes('SECRET') || key.includes('KEY');
            const isVisible = visibleSecrets[key];
            const currentVal = settingsValues[key] !== undefined ? settingsValues[key] : (typeof s === 'object' ? s.value || '' : '');

            return (
              <div key={key} className="bg-[#0b1426] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 md:w-1/3">
                  <span className="text-xs font-bold font-mono text-[#f0b90b]">{key}</span>
                  {settingsStatus[key] && (
                    <p className="text-[10px] text-green-400 font-semibold">{settingsStatus[key]}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type={isSecret && !isVisible ? 'password' : 'text'}
                    value={currentVal}
                    onChange={(e) => setSettingsValues({ ...settingsValues, [key]: e.target.value })}
                    className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white font-mono text-xs focus:border-[#f0b90b] outline-none"
                    placeholder="Qiymatni kiriting..."
                  />
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => setVisibleSecrets({ ...visibleSecrets, [key]: !isVisible })}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">{isVisible ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  )}
                  <button
                    disabled={savingKey === key}
                    onClick={() => handleSaveSetting(key, currentVal)}
                    className="px-4 py-2.5 bg-[#f0b90b] hover:bg-[#d4a009] disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition-all whitespace-nowrap cursor-pointer"
                  >
                    {savingKey === key ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
