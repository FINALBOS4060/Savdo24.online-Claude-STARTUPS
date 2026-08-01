import React, { useState } from 'react';
import { Megaphone, List, EyeOff, Eye, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';

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
  const [sponsorToDeleteId, setSponsorToDeleteId] = useState<any | null>(null);

  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={!!sponsorToDeleteId}
        title="Kanalni o'chirish"
        message="Haqiqatan ham ushbu sponsor kanalini o'chirmoqchimisiz? Bu amal qaytarilmas."
        variant="danger"
        confirmText="O'chirish"
        cancelText="Bekor qilish"
        onConfirm={() => {
          if (sponsorToDeleteId) {
            handleSponsorAction(sponsorToDeleteId, 'delete');
            setSponsorToDeleteId(null);
          }
        }}
        onCancel={() => setSponsorToDeleteId(null)}
      />
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
          <Megaphone className="text-secondary w-5 h-5" />
          Yangi sponsor kanal qo'shish
        </h2>
        <form onSubmit={handleAddSponsor} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-primary-container uppercase tracking-wider">Kanal ID</label>
            <input
              required
              type="text"
              placeholder="-100..."
              value={newSponsor.channelId}
              onChange={e => setNewSponsor({...newSponsor, channelId: e.target.value})}
              className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-primary-container uppercase tracking-wider">Kanal Username</label>
            <input
              required
              type="text"
              placeholder="savdo24_uz"
              value={newSponsor.channelUsername}
              onChange={e => setNewSponsor({...newSponsor, channelUsername: e.target.value})}
              className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-primary-container uppercase tracking-wider">Ko'rinadigan nom</label>
            <input
              required
              type="text"
              placeholder="Savdo24 Rasmiy"
              value={newSponsor.displayName}
              onChange={e => setNewSponsor({...newSponsor, displayName: e.target.value})}
              className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-primary-container uppercase tracking-wider">Reklamaberuvchi kontakti</label>
            <input
              type="text"
              placeholder="@user_admin"
              value={newSponsor.advertiserContact}
              onChange={e => setNewSponsor({...newSponsor, advertiserContact: e.target.value})}
              className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-primary-container uppercase tracking-wider">Narxi (oyiga $)</label>
            <input
              type="number"
              placeholder="10"
              value={newSponsor.pricePerMonth}
              onChange={e => setNewSponsor({...newSponsor, pricePerMonth: e.target.value})}
              className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-primary-container uppercase tracking-wider">Boshlanish sanasi</label>
            <input
              type="date"
              value={newSponsor.startDate}
              onChange={e => setNewSponsor({...newSponsor, startDate: e.target.value})}
              className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-primary-container uppercase tracking-wider">Tugash sanasi</label>
            <input
              type="date"
              value={newSponsor.endDate}
              onChange={e => setNewSponsor({...newSponsor, endDate: e.target.value})}
              className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
          <div className="flex gap-2 items-end">
            <button
              type="submit"
              disabled={isAddingSponsor}
              className="w-full px-6 py-2.5 bg-secondary hover:brightness-110 disabled:opacity-50 text-on-secondary font-black text-xs rounded-xl transition-all h-[42px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container"
            >
              {isAddingSponsor ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
          <List className="text-secondary w-5 h-5" />
          Mavjud sponsor kanallar ({sponsorChannels.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5 text-xs text-left">
            <thead>
              <tr className="text-on-primary-container font-bold uppercase tracking-wider text-xs">
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
                  <td className="py-3.5 px-4 text-on-primary-container">@{chan.channelUsername || chan.username}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${chan.isActive ? 'bg-success-container/10 text-success border border-success/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {chan.isActive ? 'Faol' : 'Nofaol'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{chan.advertiserContact || '-'}</td>
                  <td className="py-3.5 px-4 flex items-center gap-2">
                    <button
                      onClick={() => handleSponsorAction(chan.id, 'toggle', chan.isActive)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container flex items-center justify-center"
                      title={chan.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
                      aria-label={chan.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
                    >
                      {chan.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setSponsorToDeleteId(chan.id)}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center justify-center"
                      title="O'chirish"
                      aria-label="Sponsor kanalini o'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {sponsorChannels.length === 0 && !isLoadingSponsors && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-on-primary-container">Kanallar topilmadi</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
