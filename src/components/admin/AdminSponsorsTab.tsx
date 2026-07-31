import React from 'react';

interface AdminSponsorsTabProps {
  newSponsor: any;
  setNewSponsor: React.Dispatch<React.SetStateAction<any>>;
  handleAddSponsor: (e: React.FormEvent) => void;
  isAddingSponsor: boolean;
  sponsorChannels: any[];
  isLoadingSponsors: boolean;
  handleSponsorAction: (id: any, action: 'toggle' | 'delete', currentActive?: boolean) => void;
}

export const AdminSponsorsTab: React.FC<AdminSponsorsTabProps> = ({
  newSponsor,
  setNewSponsor,
  handleAddSponsor,
  isAddingSponsor,
  sponsorChannels,
  isLoadingSponsors,
  handleSponsorAction,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
          <span className="material-symbols-outlined text-[#f0b90b]">campaign</span>
          Yangi sponsor kanal qo'shish
        </h2>
        <form onSubmit={handleAddSponsor} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#8892b0] uppercase">Kanal ID</label>
            <input
              required
              type="text"
              placeholder="-100..."
              value={newSponsor.channelId}
              onChange={e => setNewSponsor({...newSponsor, channelId: e.target.value})}
              className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#8892b0] uppercase">Kanal Username</label>
            <input
              required
              type="text"
              placeholder="savdo24_uz"
              value={newSponsor.channelUsername}
              onChange={e => setNewSponsor({...newSponsor, channelUsername: e.target.value})}
              className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#8892b0] uppercase">Ko'rinadigan nom</label>
            <input
              required
              type="text"
              placeholder="Savdo24 Rasmiy"
              value={newSponsor.displayName}
              onChange={e => setNewSponsor({...newSponsor, displayName: e.target.value})}
              className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#8892b0] uppercase">Reklamaberuvchi kontakti</label>
            <input
              type="text"
              placeholder="@user_admin"
              value={newSponsor.advertiserContact}
              onChange={e => setNewSponsor({...newSponsor, advertiserContact: e.target.value})}
              className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#8892b0] uppercase">Narxi (oyiga $)</label>
            <input
              type="number"
              placeholder="10"
              value={newSponsor.pricePerMonth}
              onChange={e => setNewSponsor({...newSponsor, pricePerMonth: e.target.value})}
              className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#8892b0] uppercase">Boshlanish sanasi</label>
            <input
              type="date"
              value={newSponsor.startDate}
              onChange={e => setNewSponsor({...newSponsor, startDate: e.target.value})}
              className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#8892b0] uppercase">Tugash sanasi</label>
            <input
              type="date"
              value={newSponsor.endDate}
              onChange={e => setNewSponsor({...newSponsor, endDate: e.target.value})}
              className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
            />
          </div>
          <div className="flex gap-2 items-end">
            <button
              type="submit"
              disabled={isAddingSponsor}
              className="w-full px-6 py-2.5 bg-[#f0b90b] hover:bg-[#d4a009] disabled:opacity-50 text-[#12161c] font-black text-xs rounded-xl transition-all h-[42px] cursor-pointer"
            >
              {isAddingSponsor ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
          <span className="material-symbols-outlined text-[#f0b90b]">list</span>
          Mavjud sponsor kanallar ({sponsorChannels.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5 text-xs text-left">
            <thead>
              <tr className="text-[#8892b0] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Kanal</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Holat</th>
                <th className="py-3 px-4">Kontakt</th>
                <th className="py-3 px-4">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {sponsorChannels.map((chan) => (
                <tr key={chan.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">{chan.displayName || chan.title}</td>
                  <td className="py-3.5 px-4 text-[#8892b0]">@{chan.channelUsername || chan.username}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${chan.isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {chan.isActive ? 'Faol' : 'Nofaol'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{chan.advertiserContact || '-'}</td>
                  <td className="py-3.5 px-4 flex items-center gap-2">
                    <button
                      onClick={() => handleSponsorAction(chan.id, 'toggle', chan.isActive)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                      title={chan.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
                    >
                      <span className="material-symbols-outlined text-sm">{chan.isActive ? 'visibility_off' : 'visibility'}</span>
                    </button>
                    <button
                      onClick={() => {
                        if(window.confirm("Haqiqatan ham o'chirmoqchimisiz?")) handleSponsorAction(chan.id, 'delete');
                      }}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer"
                      title="O'chirish"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {sponsorChannels.length === 0 && !isLoadingSponsors && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#8892b0]">Kanallar topilmadi</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
