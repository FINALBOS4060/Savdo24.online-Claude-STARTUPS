import React from 'react';
import { formatDate } from '../../lib/formatDate';

interface AdminDashboardTabProps {
  stats: any;
  setActiveTab: (tab: any) => void;
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({ stats, setActiveTab }) => {
  if (!stats) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-surface-container-low border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Foydalanuvchilar</span>
            <span className="material-symbols-outlined text-blue-400">group</span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{stats.totalUsers}</div>
          <p className="text-xs text-[#8892b0]">Jami ro'yxatdan o'tganlar</p>
        </div>

        <div className="p-6 bg-surface-container-low border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Faol e'lonlar</span>
            <span className="material-symbols-outlined text-success">rocket_launch</span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{stats.totalActiveStartups}</div>
          <p className="text-xs text-[#8892b0]">Hozirda sotuvdagilar</p>
        </div>

        <div className="p-6 bg-surface-container-low border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Yakunlangan savdolar</span>
            <span className="material-symbols-outlined text-secondary">handshake</span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{stats.totalCompletedSales}</div>
          <p className="text-xs text-success font-bold">Muvaffaqiyatli bitimlar</p>
        </div>

        <div className="p-6 bg-surface-container-low border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Platforma daromadi</span>
            <span className="material-symbols-outlined text-success">toll</span>
          </div>
          <div className="text-2xl font-black font-mono text-secondary">${stats.totalCommission.toLocaleString()}</div>
          <p className="text-xs text-success font-bold">Joriy oy: +${stats.monthlyCommission.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Oxirgi Nizolar */}
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 shadow-2xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-400">gavel</span>
              Oxirgi 5 ta nizo
            </span>
            <button
              onClick={() => setActiveTab('disputes')}
              className="text-xs text-secondary hover:underline bg-transparent border-none cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-secondary-container rounded-lg px-2 py-1"
              aria-label="Barcha nizolarni ko'rish"
            >
              Barchasini ko'rish
            </button>
          </h3>
          <div className="space-y-4">
            {stats.lastDisputes?.length > 0 ? stats.lastDisputes.map((d: any) => (
              <div key={d.id} className="bg-surface-container-low p-4 rounded-xl border border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-white">{d.reason}</p>
                  <p className="text-xs text-on-primary-container">{d.buyer} • {formatDate(d.date)}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${d.status === 'open' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-success-container/10 text-success border border-success/20'}`}>
                  {d.status === 'open' ? 'Ochiq' : 'Yopilgan'}
                </span>
              </div>
            )) : <p className="text-xs text-on-primary-container italic py-4">Nizolar mavjud emas</p>}
          </div>
        </div>

        {/* Oxirgi Shikoyatlar */}
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 shadow-2xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">flag</span>
              Oxirgi 5 ta shikoyat
            </span>
            <button
              onClick={() => setActiveTab('reports')}
              className="text-xs text-secondary hover:underline bg-transparent border-none cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-secondary-container rounded-lg px-2 py-1"
              aria-label="Barcha shikoyatlarni ko'rish"
            >
              Barchasini ko'rish
            </button>
          </h3>
          <div className="space-y-4">
            {stats.lastReports?.length > 0 ? stats.lastReports.map((r: any) => (
              <div key={r.id} className="bg-surface-container-low p-4 rounded-xl border border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-white">{r.reason}</p>
                  <p className="text-xs text-on-primary-container">{r.targetType} • {formatDate(r.date)}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-success-container/10 text-success border border-success/20'}`}>
                  {r.status === 'pending' ? 'Kutilmoqda' : 'Ko\'rildi'}
                </span>
              </div>
            )) : <p className="text-xs text-on-primary-container italic py-4">Shikoyatlar mavjud emas</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
