import React from 'react';
import { Startup } from '../../types';

interface AdminReportsTabProps {
  reports: any[];
  startups: Startup[];
  handleReportStatusChange: (id: number, status: 'reviewed' | 'dismissed') => void;
  updatingReportId: number | null;
  isDeletingReportedItem: number | null;
  handleDeleteReportedItem: (reportId: number, targetType: string, targetId: string) => void;
  setActiveTab: (tab: any) => void;
  setUsersSearch: (val: string) => void;
  reportsPage: number;
  reportsTotalPages: number;
  fetchReports: (page?: number) => void;
  renderPagination: (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => React.ReactNode;
}

export const AdminReportsTab: React.FC<AdminReportsTabProps> = ({
  reports,
  startups,
  handleReportStatusChange,
  updatingReportId,
  isDeletingReportedItem,
  handleDeleteReportedItem,
  setActiveTab,
  setUsersSearch,
  reportsPage,
  reportsTotalPages,
  fetchReports,
  renderPagination,
}) => {
  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
      <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
        <span className="material-symbols-outlined text-red-500">flag</span>
        Foydalanuvchilar shikoyatlari (Shikoyatlar) ({reports.length})
      </h2>

      {reports.length === 0 ? (
        <div className="py-12 text-center text-on-primary-container space-y-2">
          <span className="material-symbols-outlined text-4xl opacity-40">flag</span>
          <p className="text-sm font-bold">Hech qanday shikoyatlar mavjud emas</p>
          <p className="text-xs">Barcha e'lonlar va kontent toza holatda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => {
            const reportedStartup = report.targetType === 'startup' 
              ? startups.find((s) => s.id === report.targetId) 
              : null;

            return (
              <div
                key={report.id}
                className="bg-[#0b1426] border border-white/5 hover:border-white/10 rounded-2xl p-5 space-y-4 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        {report.targetType === 'startup' ? "E'lon" : report.targetType === 'user' ? "Foydalanuvchi" : "Izoh / G'oya"}
                      </span>
                      <span className="text-[#8892b0] text-[10px]">ID: {report.targetId}</span>
                    </div>
                    <h4 className="text-white font-black text-sm">
                      {report.targetType === 'startup' 
                        ? (reportedStartup ? `Loyiha: ${reportedStartup.name}` : `Noma'lum Loyiha (ID: ${report.targetId})`)
                        : report.targetType === 'user'
                        ? `Foydalanuvchi (ID: ${report.targetId})`
                        : `Izoh (ID: ${report.targetId})`
                      }
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border ${
                      report.status === 'pending'
                        ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        : report.status === 'reviewed'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }`}>
                      {report.status === 'pending' ? 'Kutilmoqda' : report.status === 'reviewed' ? 'Ko\'rib chiqildi' : 'Rad etildi'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 bg-[#0e1726] p-3.5 rounded-xl border border-white/5">
                    <span className="text-[#f3ba2f] font-bold uppercase text-[9px] tracking-wider block">Shikoyat sababi</span>
                    <p className="text-white font-extrabold">"{report.reason}"</p>
                    <p className="text-[#8892b0] text-[10px] mt-1.5">{new Date(report.createdAt).toLocaleString("uz-UZ")}</p>
                  </div>

                  <div className="space-y-1 bg-[#0e1726] p-3.5 rounded-xl border border-white/5">
                    <span className="text-red-400/80 font-bold uppercase text-[9px] tracking-wider block">Tavsif / Izoh</span>
                    <p className="text-on-primary-container text-[11px] leading-relaxed italic">
                      {report.description ? `"${report.description}"` : "Izoh qoldirilmagan"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    {report.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleReportStatusChange(report.id, 'reviewed')}
                          disabled={updatingReportId === report.id || isDeletingReportedItem === report.id}
                          className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-[#12161c] font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-xs">check</span>
                          Tasdiqlash (Ko'rib chiqildi)
                        </button>
                        <button
                          onClick={() => handleReportStatusChange(report.id, 'dismissed')}
                          disabled={updatingReportId === report.id || isDeletingReportedItem === report.id}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-50 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                          Inkor etish (Rad etish)
                        </button>
                      </>
                    )}
                  </div>

                  {report.targetType === 'user' ? (
                    <button
                      onClick={() => {
                        setActiveTab('users');
                        setUsersSearch(report.targetId);
                      }}
                      className="px-3 py-2 bg-white/5 text-white border border-white/10 hover:bg-white/10 font-black text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-xs">person_search</span>
                      Foydalanuvchini ko'rish
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeleteReportedItem(report.id, report.targetType, report.targetId)}
                      disabled={updatingReportId === report.id || isDeletingReportedItem === report.id}
                      className="px-3 py-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white disabled:opacity-50 font-black text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                      {isDeletingReportedItem === report.id ? "O'chirilmoqda..." : (report.targetType === 'startup' ? "E'lonni o'chirish" : "Izohni o'chirish")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {renderPagination(reportsPage, reportsTotalPages, fetchReports)}
        </div>
      )}
    </div>
  );
};
