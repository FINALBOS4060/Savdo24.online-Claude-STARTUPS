import React, { useState } from 'react';
import { Headphones, MailOpen } from 'lucide-react';
import { LoadingState } from '../LoadingState';
import { formatDateTime } from '../../lib/formatDate';
// apiFetch: qolgan admin sahifalar kabi 401-refresh/retry mantig'idan foydalanish uchun.
import { apiFetch as fetch } from '../../lib/api';

interface AdminSupportTabProps {
  supportTickets: any[];
  isLoadingSupport: boolean;
  updatingTicketId: string | null;
  setUpdatingTicketId: React.Dispatch<React.SetStateAction<string | null>>;
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
  const [replies, setReplies] = useState<Record<string, string>>({});

  const handleReply = async (ticketId: string) => {
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
        // TUZATISH: optimistik yangilanish faqat `status`'ni 'closed'ga
        // o'zgartirardi, `adminReply`'ni EMAS — natijada javob muvaffaqiyatli
        // yuborilgandan keyin ham ("Javob yuborildi" xabari ko'rinsa ham)
        // "Sizning javobingiz" bloki paydo bo'lmasdi (sahifa qayta
        // yuklanmaguncha), chunki lokal holatda `adminReply` hali bo'sh edi —
        // admin javobi haqiqatda yuborilgan-yubormaganini shubha ostida
        // qoldirardi. Endi yozilgan matn ham darhol lokal holatga qo'shiladi.
        setSupportTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'closed', adminReply: text } : t));
      } else {
        const data = await res.json().catch(() => ({}));
        onActionToast(data.error || "Javob yuborishda xatolik yuz berdi");
      }
    } catch (err) {
      console.error("Support reply error:", err);
      onActionToast("Javob yuborishda xatolik yuz berdi");
    } finally {
      setUpdatingTicketId(null);
    }
  };

  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
      <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2 border-b border-white/5 pb-4">
        <Headphones className="text-secondary w-5 h-5" />
        Murojaatlar ({supportTickets.length})
      </h2>

      {isLoadingSupport ? (
        <LoadingState variant="block" text="Murojaatlar yuklanmoqda..." />
      ) : supportTickets.length === 0 ? (
        <div className="py-12 text-center text-on-primary-container space-y-2">
          <MailOpen className="w-10 h-10 mx-auto opacity-40 text-on-primary-container" />
          <p className="text-sm font-bold">Murojaatlar yo'q</p>
        </div>
      ) : (
        <div className="space-y-4">
          {supportTickets.map((ticket) => (
            <div key={ticket.id} className="bg-surface-container-low border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-white/5 pb-3">
                <div>
                  <h4 className="text-on-primary-container font-bold text-sm">{ticket.subject || ticket.title || "Murojaat"}</h4>
                  <p className="text-xs text-on-primary-container">
                    Foydalanuvchi: <span className="text-on-primary-container font-semibold">{ticket.user?.name || ticket.user?.email || ticket.userId}</span> • {formatDateTime(ticket.createdAt)}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase border w-max ${
                  ticket.status === 'closed' || ticket.status === 'resolved' ? 'bg-success-container/10 text-success border-success/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {ticket.status === 'closed' || ticket.status === 'resolved' ? 'Yopilgan' : 'Ochiq'}
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed bg-white/5 p-3 rounded-xl">{ticket.message || ticket.content}</p>

              {ticket.adminReply && (
                <div className="text-xs text-emerald-300 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                  <p className="font-extrabold uppercase tracking-wider text-[10px] mb-1 text-emerald-400">Sizning javobingiz</p>
                  {ticket.adminReply}
                </div>
              )}

              {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                <div className="space-y-2 pt-2">
                  <textarea
                    rows={2}
                    placeholder="Javobingizni yozing..."
                    value={replies[ticket.id] || ''}
                    onChange={(e) => setReplies({ ...replies, [ticket.id]: e.target.value })}
                    className="w-full p-3 bg-surface-container border border-white/10 rounded-xl text-xs text-on-primary-container placeholder-on-primary-container/50 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
                  />
                  <div className="flex justify-end">
                    <button
                      disabled={updatingTicketId === ticket.id || !(replies[ticket.id] || '').trim()}
                      onClick={() => handleReply(ticket.id)}
                      className="px-4 py-2 bg-secondary hover:brightness-110 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container"
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
