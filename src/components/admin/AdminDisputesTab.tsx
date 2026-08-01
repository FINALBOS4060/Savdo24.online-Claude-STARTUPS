import React from 'react';
import { LoadingState } from '../LoadingState';
import { formatDateTime } from '../../lib/formatDate';

interface AdminDisputesTabProps {
  disputes: any[];
  adminNotes: Record<number, string>;
  setAdminNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  updatingDisputeId: number | null;
  handleDisputeUpdate: (id: number, status: 'resolved' | 'rejected') => void;
  disputesPage: number;
  disputesTotalPages: number;
  fetchDisputes: (page?: number) => void;
  renderPagination: (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => React.ReactNode;
  escrowDisputes: any[];
  isLoadingEscrowDisputes: boolean;
  escrowAdminNotes: Record<string, string>;
  setEscrowAdminNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updatingEscrowDisputeId: string | null;
  handleEscrowDisputeUpdate: (id: string, resolution: 'released' | 'refunded') => void;
}

export const AdminDisputesTab: React.FC<AdminDisputesTabProps> = ({
  disputes,
  adminNotes,
  setAdminNotes,
  updatingDisputeId,
  handleDisputeUpdate,
  disputesPage,
  disputesTotalPages,
  fetchDisputes,
  renderPagination,
  escrowDisputes,
  isLoadingEscrowDisputes,
  escrowAdminNotes,
  setEscrowAdminNotes,
  updatingEscrowDisputeId,
  handleEscrowDisputeUpdate,
}) => {
  return (
    <div className="space-y-8">
      {/* General Disputes */}
      <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
          <span className="material-symbols-outlined text-red-400">gavel</span>
          Sotib oluvchilar arizalari va Nizolar ({disputes.length})
        </h2>

        {disputes.length === 0 ? (
          <div className="py-12 text-center text-on-primary-container space-y-2">
            <span className="material-symbols-outlined text-4xl opacity-40">gavel</span>
            <p className="text-sm font-bold">Hech qanday nizo arizalari mavjud emas</p>
            <p className="text-xs">Platformada barcha xaridlar muammosiz davom etmoqda.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {disputes.map((disp) => (
              <div
                key={disp.id}
                className="bg-surface-container-low border border-white/5 hover:border-white/10 rounded-2xl p-5 space-y-4 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <div>
                    <span className="text-xs uppercase font-bold text-[#8892b0] block">Buyurtma va Loyiha</span>
                    <span className="text-white font-black text-sm">{disp.payment?.startup?.name || "Noma'lum loyiha"}</span>
                    <span className="text-xs text-on-primary-container block mt-0.5">ID: {disp.paymentId} • Narxi: ${disp.payment?.startup?.price?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-md border ${
                      disp.status === 'open'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : disp.status === 'resolved'
                        ? 'bg-success-container/10 text-success border-success/20'
                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }`}>
                      {disp.status === 'open' ? 'Ochiq nizo' : disp.status === 'resolved' ? 'Yopilgan' : 'Rad etilgan'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 bg-surface-container p-3.5 rounded-xl border border-white/5">
                    <span className="text-secondary/80 font-bold uppercase text-xs tracking-wider block">Nizo ochuvchi xaridor</span>
                    <p className="text-white font-extrabold">{disp.buyer?.name}</p>
                    <p className="text-on-primary-container text-xs">{disp.buyer?.email}</p>
                    <p className="text-[#8892b0] text-xs mt-1.5">{formatDateTime(disp.createdAt)}</p>
                  </div>

                  <div className="space-y-1 bg-surface-container p-3.5 rounded-xl border border-white/5">
                    <span className="text-red-400/80 font-bold uppercase text-xs tracking-wider block">Muammo va Sababi</span>
                    <p className="text-white font-extrabold">"{disp.reason}"</p>
                    <p className="text-on-primary-container text-xs leading-relaxed mt-1">"{disp.description}"</p>
                  </div>
                </div>

                {disp.status === 'open' ? (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase font-bold text-[#8892b0]">Admin qarori / Izohi (adminNote):</label>
                      <input
                        type="text"
                        placeholder="Nizoni yopish yoki rad etish sababini batafsil yozing..."
                        value={adminNotes[disp.id] || ""}
                        onChange={(e) => setAdminNotes({ ...adminNotes, [disp.id]: e.target.value })}
                        className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs placeholder-[#8892b0]/50 focus:outline-none focus:ring-2 focus:ring-secondary-container transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        disabled={updatingDisputeId !== null}
                        onClick={() => handleDisputeUpdate(disp.id, 'resolved')}
                        className="px-4 py-2 bg-success hover:brightness-110 disabled:opacity-50 text-[#12161c] font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-md focus:outline-none focus:ring-2 focus:ring-success"
                      >
                        <span className="material-symbols-outlined text-xs">gavel</span>
                        Nizoni hal etish (Yopish)
                      </button>
                      <button
                        disabled={updatingDisputeId !== null}
                        onClick={() => handleDisputeUpdate(disp.id, 'rejected')}
                        className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <span className="material-symbols-outlined text-xs">cancel</span>
                        Rad etish
                      </button>
                    </div>
                  </div>
                ) : (
                  disp.adminNote && (
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs">
                      <span className="text-[#8892b0] font-bold block uppercase text-xs">Admin qarori izohi:</span>
                      <p className="text-gray-300 italic mt-0.5">"{disp.adminNote}"</p>
                    </div>
                  )
                )}
              </div>
            ))}
            {renderPagination(disputesPage, disputesTotalPages, fetchDisputes)}
          </div>
        )}
      </div>

      {/* Escrow Disputes */}
      <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
          <span className="material-symbols-outlined text-red-400">account_balance</span>
          Escrow (kafolatlangan to'lov) nizolari ({escrowDisputes.length})
        </h2>

        {isLoadingEscrowDisputes ? (
          <LoadingState variant="block" text="Escrow nizolari yuklanmoqda..." />
        ) : escrowDisputes.length === 0 ? (
          <div className="py-12 text-center text-on-primary-container space-y-2">
            <span className="material-symbols-outlined text-4xl opacity-40">account_balance</span>
            <p className="text-sm font-bold">Hech qanday escrow nizosi mavjud emas</p>
            <p className="text-xs">Barcha kafolatlangan to'lovlar muammosiz davom etmoqda.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {escrowDisputes.map((ed) => (
              <div
                key={ed.id}
                className="bg-surface-container-low border border-white/5 hover:border-white/10 rounded-2xl p-5 space-y-4 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <div>
                    <span className="text-xs uppercase font-bold text-[#8892b0] block">Loyiha</span>
                    <span className="text-white font-black text-sm">{ed.escrow?.payment?.startup?.name || "Noma'lum loyiha"}</span>
                    <span className="text-xs text-on-primary-container block mt-0.5">To'lov ID: {ed.escrow?.paymentId} • Narxi: ${ed.escrow?.payment?.startup?.price?.toLocaleString()}</span>
                  </div>
                  <span className="text-xs font-extrabold uppercase px-2.5 py-1 rounded-md border bg-red-500/10 text-red-400 border-red-500/20">
                    Hal qilinmagan
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 bg-surface-container p-3.5 rounded-xl border border-white/5">
                    <span className="text-secondary/80 font-bold uppercase text-xs tracking-wider block">Nizo ochuvchi xaridor</span>
                    <p className="text-white font-extrabold">{ed.escrow?.payment?.user?.name}</p>
                    <p className="text-on-primary-container text-xs">{ed.escrow?.payment?.user?.email}</p>
                    <p className="text-[#8892b0] text-xs mt-1.5">{formatDateTime(ed.createdAt)}</p>
                  </div>

                  <div className="space-y-1 bg-surface-container p-3.5 rounded-xl border border-white/5">
                    <span className="text-red-400/80 font-bold uppercase text-xs tracking-wider block">Nizo sababi</span>
                    <p className="text-white font-extrabold">"{ed.reason}"</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase font-bold text-[#8892b0]">Admin qarori / Izohi (adminNote):</label>
                    <input
                      type="text"
                      placeholder="Qarorni asoslab yozing (masalan: dalillar tekshirildi, xaridorning haqi ...)"
                      value={escrowAdminNotes[ed.id] || ""}
                      onChange={(e) => setEscrowAdminNotes({ ...escrowAdminNotes, [ed.id]: e.target.value })}
                      className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs placeholder-[#8892b0]/50 focus:outline-none focus:ring-2 focus:ring-secondary-container transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      disabled={updatingEscrowDisputeId !== null}
                      onClick={() => handleEscrowDisputeUpdate(ed.id, 'released')}
                      className="px-4 py-2 bg-success hover:brightness-110 disabled:opacity-50 text-[#12161c] font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-md focus:outline-none focus:ring-2 focus:ring-success"
                    >
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Sotuvchiga ozod qilish
                    </button>
                    <button
                      disabled={updatingEscrowDisputeId !== null}
                      onClick={() => handleEscrowDisputeUpdate(ed.id, 'refunded')}
                      className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <span className="material-symbols-outlined text-xs">undo</span>
                      Xaridorga qaytarish
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
