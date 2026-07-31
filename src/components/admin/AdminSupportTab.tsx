import React, { useState } from 'react';

interface AdminSupportTabProps {
  supportTickets: any[];
  isLoadingSupport: boolean;
  updatingTicketId: number | null;
  setUpdatingTicketId: React.Dispatch<React.SetStateAction<number | null>>;
  setSupportTickets: React.Dispatch<React.SetStateAction<any[]>>;
  onActionToast: (message: string) => void;
}

export const AdminSupportTab: React.FC<AdminSupportTabProps> = ({
  supportTickets,
  isLoadingSupport,
  updatingTicketId,
  setUpdatingTicketId,
  setSupportTickets,
  onActionToast,
}) => {
  const [replies, setReplies] = useState<Record<number, string>>({});

  const handleReply = async (ticketId: number) => {
    const text = replies[ticketId];
    if (!text || !text.trim()) return;

    setUpdatingTicketId(ticketId);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        onActionToast("Javob yuborildi");
        setReplies(prev => ({ ...prev, [ticketId]: '' }));
        setSupportTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'closed' } : t));
      }
    } catch (err) {
      console.error("Support reply error:", err);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
      <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
        <span className="material-symbols-outlined text-[#f0b90b]">support_agent</span>
        Murojaatlar ({supportTickets.length})
      </h2>

      {isLoadingSupport ? (
        <div className="py-12 text-center text-on-primary-container">
          <span className="animate-spin inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mb-2"></span>
          <p className="text-sm font-bold">Yuklanmoqda...</p>
        </div>
      ) : supportTickets.length === 0 ? (
        <div className="py-12 text-center text-on-primary-container space-y-2">
          <span className="material-symbols-outlined text-4xl opacity-40">mark_email_read</span>
          <p className="text-sm font-bold">Murojaatlar yo'q</p>
        </div>
      ) : (
        <div className="space-y-4">
          {supportTickets.map((ticket) => (
            <div key={ticket.id} className="bg-[#0b1426] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-white/5 pb-3">
                <div>
                  <h4 className="text-white font-bold text-sm">{ticket.subject || ticket.title || "Murojaat"}</h4>
                  <p className="text-xs text-[#8892b0]">
                    Foydalanuvchi: <span className="text-white font-semibold">{ticket.user?.name || ticket.user?.email || ticket.userId}</span> • {new Date(ticket.createdAt).toLocaleString("uz-UZ")}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border w-max ${
                  ticket.status === 'open' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'
                }`}>
                  {ticket.status === 'open' ? 'Ochiq' : 'Yopilgan'}
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed bg-white/5 p-3 rounded-xl">{ticket.message || ticket.content}</p>

              {ticket.status === 'open' && (
                <div className="space-y-2 pt-2">
                  <textarea
                    rows={2}
                    placeholder="Javobingizni yozing..."
                    value={replies[ticket.id] || ''}
                    onChange={(e) => setReplies({ ...replies, [ticket.id]: e.target.value })}
                    className="w-full p-3 bg-[#0e1726] border border-white/10 rounded-xl text-xs text-white placeholder-[#8892b0]/50 focus:border-[#f0b90b] outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      disabled={updatingTicketId === ticket.id || !(replies[ticket.id] || '').trim()}
                      onClick={() => handleReply(ticket.id)}
                      className="px-4 py-2 bg-[#f0b90b] hover:bg-[#d4a009] disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      {updatingTicketId === ticket.id ? 'Yuborilmoqda...' : 'Javob berish'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
