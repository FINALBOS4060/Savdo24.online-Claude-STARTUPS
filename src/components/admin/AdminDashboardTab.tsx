import React from 'react';

interface AdminDashboardTabProps {
  stats: any;
  setActiveTab: (tab: any) => void;
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({ stats, setActiveTab }) => {
  if (!stats) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-[#0e1726]/80 border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase">Foydalanuvchilar</span>
            <span className="material-symbols-outlined text-blue-400">group</span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{stats.totalUsers}</div>
          <p className="text-[10px] text-[#8892b0]">Jami ro'yxatdan o'tganlar</p>
        </div>

        <div className="p-6 bg-[#0e1726]/80 border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase">Faol e'lonlar</span>
            <span className="material-symbols-outlined text-green-400">rocket_launch</span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{stats.totalActiveStartups}</div>
          <p className="text-[10px] text-[#8892b0]">Hozirda sotuvdagilar</p>
        </div>

        <div className="p-6 bg-[#0e1726]/80 border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase">Yakunlangan savdolar</span>
            <span className="material-symbols-outlined text-[#f3ba2f]">handshake</span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{stats.totalCompletedSales}</div>
          <p className="text-[10px] text-green-500 font-bold">Muvaffaqiyatli bitimlar</p>
        </div>

        <div className="p-6 bg-[#0e1726]/80 border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase">Platforma daromadi</span>
            <span className="material-symbols-outlined text-emerald-400">toll</span>
          </div>
          <div className="text-2xl font-black font-mono text-[#f3ba2f]">${stats.totalCommission.toLocaleString()}</div>
          <p className="text-[10px] text-emerald-500 font-bold">Joriy oy: +${stats.monthlyCommission.toLocaleString()}</p>
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
            <button onClick={() => setActiveTab('disputes')} className="text-xs text-[#f0b90b] hover:underline bg-transparent border-none cursor-pointer font-bold">Barchasini ko'rish</button>
          </h3>
          <div className="space-y-4">
            {stats.lastDisputes?.length > 0 ? stats.lastDisputes.map((d: any) => (
              <div key={d.id} className="bg-[#0b1426] p-4 rounded-xl border border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-white">{d.reason}</p>
                  <p className="text-[10px] text-on-primary-container">{d.buyer} • {new Date(d.date).toLocaleDateString()}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${d.status === 'open' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
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
              <span className="material-symbols-outlined text-yellow-500">flag</span>
              Oxirgi 5 ta shikoyat
            </span>
            <button onClick={() => setActiveTab('reports')} className="text-xs text-[#f0b90b] hover:underline bg-transparent border-none cursor-pointer font-bold">Barchasini ko'rish</button>
          </h3>
          <div className="space-y-4">
            {stats.lastReports?.length > 0 ? stats.lastReports.map((r: any) => (
              <div key={r.id} className="bg-[#0b1426] p-4 rounded-xl border border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-white">{r.reason}</p>
                  <p className="text-[10px] text-on-primary-container">{r.targetType} • {new Date(r.date).toLocaleDateString()}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${r.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-400'}`}>
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
