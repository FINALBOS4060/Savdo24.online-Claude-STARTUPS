import React from 'react';

interface ProfilePurchasesTabProps {
  myPurchases: any[];
  escrows: any[];
  setEscrows: React.Dispatch<React.SetStateAction<any[]>>;
  escrowActionId: string | null;
  setEscrowActionId: React.Dispatch<React.SetStateAction<string | null>>;
  handleCardClick: (id: string) => void;
  onActionToast: (message: string) => void;
}

export const ProfilePurchasesTab: React.FC<ProfilePurchasesTabProps> = ({
  myPurchases,
  escrows,
  setEscrows,
  escrowActionId,
  setEscrowActionId,
  handleCardClick,
  onActionToast,
}) => {
  return (
    <section className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white border-b border-outline-variant/15 pb-4 mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary-container">shopping_cart</span>
        Mening xaridlarim
      </h3>
      {myPurchases.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-outline-variant/20 rounded-2xl">
          <span className="material-symbols-outlined text-5xl text-on-primary-container/30 mb-3 block">receipt_long</span>
          <p className="text-on-primary-container font-medium">Hozircha xaridlar yo'q</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myPurchases.map(payment => (
            <div key={payment.id} className="bg-background border border-outline-variant/20 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-outline-variant/40 transition-colors">
              <div>
                <h4 className="font-bold text-white text-lg">{payment.startup?.name || 'Noma\'lum loyiha'}</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-on-primary-container">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">payments</span>{payment.amount} {payment.currency}</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">calendar_today</span>{new Date(payment.createdAt).toLocaleDateString()}</span>
                  {payment.status === 'refund_required' && (
                    <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs rounded-lg font-bold">Qaytarish jarayonda (Refund in progress)</span>
                  )}
                  {payment.status === 'refund_completed' && (
                    <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs rounded-lg font-bold">Pul qaytarildi (Refunded)</span>
                  )}
                </div>
              </div>
              {payment.startup && payment.startup.deliveryUrl ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={payment.startup.deliveryUrl} target="_blank" rel="noreferrer"
                    onClick={(e) => {
                      try {
                        const url = new URL(payment.startup.deliveryUrl!);
                        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                          e.preventDefault();
                        }
                      } catch {
                        e.preventDefault();
                      }
                    }}
                    className="px-4 py-2 bg-secondary-container/10 text-secondary-container hover:bg-secondary-container/20 rounded-lg font-bold text-sm whitespace-nowrap transition-colors border border-secondary-container/20 text-center"
                  >
                    Loyihani yuklash
                  </a>
                  {escrows.find(e => e.paymentId === payment.id)?.status === 'held' && (
                    <div className="flex gap-2">
                      <button
                        disabled={escrowActionId === payment.id}
                        onClick={async () => {
                          if (escrowActionId === payment.id) return;
                          setEscrowActionId(payment.id);
                          try {
                            const res = await fetch('/api/escrow/release', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ paymentId: payment.id })
                            });
                            const data = await res.json().catch(() => ({}));
                            if (res.ok) {
                              onActionToast("Mablag' ozod qilindi!");
                              setEscrows(prev => prev.map(e => e.paymentId === payment.id ? { ...e, status: 'released' } : e));
                            } else {
                              onActionToast(data.error || "Mablag'ni ozod qilishda xatolik yuz berdi.");
                            }
                          } catch (err) {
                            console.error("Escrow release error:", err);
                            onActionToast("Tarmoq xatosi yuz berdi.");
                          } finally {
                            setEscrowActionId(null);
                          }
                        }}
                        className="px-4 py-2 bg-emerald-500 text-black rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Tasdiqlash
                      </button>
                      <button
                        disabled={escrowActionId === payment.id}
                        onClick={() => {
                          if (escrowActionId === payment.id) return;
                          const reason = prompt("Nizo sababini yozing:");
                          if (reason) {
                              setEscrowActionId(payment.id);
                              fetch('/api/escrow/dispute', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ paymentId: payment.id, reason })
                              }).then(async (res) => {
                                const data = await res.json();
                                onActionToast(data.message || data.error);
                                if (res.ok) setEscrows(prev => prev.map(e => e.paymentId === payment.id ? { ...e, status: 'disputed' } : e));
                              }).catch((err) => {
                                console.error("Escrow dispute error:", err);
                                onActionToast("Tarmoq xatosi yuz berdi.");
                              }).finally(() => setEscrowActionId(null));
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Nizo
                      </button>
                    </div>
                  )}
                  {escrows.find(e => e.paymentId === payment.id)?.status === 'released' && (
                    <span className="px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg font-bold text-sm">
                      Yakunlangan
                    </span>
                  )}
                  {escrows.find(e => e.paymentId === payment.id)?.status === 'disputed' && (
                    <span className="px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg font-bold text-sm">
                      Nizoda
                    </span>
                  )}
                </div>
              ) : payment.startup ? (
                <button
                  onClick={() => handleCardClick(payment.startup.id)}
                  className="px-4 py-2 bg-secondary-container/10 text-secondary-container hover:bg-secondary-container/20 rounded-lg font-bold text-sm whitespace-nowrap transition-colors border border-secondary-container/20 cursor-pointer"
                >
                  Loyihani ko'rish (Aloqa kutilmoqda)
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
