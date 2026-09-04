import React, { useEffect, useState } from 'react';
import { Repeat, Send, Users2, AlertTriangle, CheckCircle2, Gift } from 'lucide-react';

interface MyExchangeChannel {
  id: number;
  title: string;
  channelUsername: string | null;
  isActive: boolean;
  suspendedReason: string | null;
  blockedByAdmin: boolean;
  subscriberCount: number;
}

export const ProfileExchangeTab: React.FC = () => {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [channels, setChannels] = useState<MyExchangeChannel[]>([]);
  const [referralBonus, setReferralBonus] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/exchange/my-channels');
        if (res.ok) {
          const data = await res.json();
          setLinked(data.linked);
          setChannels(data.channels || []);
          setReferralBonus(data.referralBonus || 0);
        }
      } catch {
        setLinked(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-8 text-center text-on-primary-container text-sm">
        Yuklanmoqda...
      </div>
    );
  }

  if (!linked) {
    return (
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl text-center space-y-4">
        <Send className="w-10 h-10 text-secondary mx-auto" />
        <h2 className="text-lg font-bold text-on-primary-container">Telegram hisobingiz ulanmagan</h2>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Obuna almashish kanallaringizni bu yerda ko'rish uchun avval Telegram botimizga (@Savdo24_Register_bot)
          <code className="mx-1 px-1.5 py-0.5 bg-white/5 rounded">/bogla</code>
          buyrug'i orqali hisobingizni ulang.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {referralBonus > 0 && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-5 shadow-2xl flex items-center gap-3">
          <Gift className="text-secondary w-6 h-6 flex-shrink-0" />
          <div>
            <div className="font-bold text-on-primary-container">Referal orqali qo'shilgan bonus: {referralBonus} ta obunachi</div>
            <div className="text-xs text-gray-400 mt-0.5">Telegram botdagi "Obunachi yig'ish" bo'limidan do'stlaringizni taklif qiling — ular o'z kanalini qo'shsa, sizga bonus obunachi qo'shiladi.</div>
          </div>
        </div>
      )}

      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
          <Repeat className="text-secondary w-5 h-5" />
          Mening obuna almashish kanallarim
        </h2>

        {channels.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-gray-400">Hali kanal qo'shmagansiz.</p>
            <p className="text-xs text-gray-500">
              Telegram botimizda "🔄 Obunachi yig'ish" bo'limi orqali o'z kanalingizni qo'shishingiz mumkin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((c) => (
              <div key={c.id} className="p-4 bg-surface-container rounded-xl border border-white/5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-on-primary-container">{c.title}</div>
                  {c.channelUsername && <div className="text-xs text-gray-400">{c.channelUsername}</div>}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                    <Users2 className="w-3.5 h-3.5" /> {c.subscriberCount} ta obunachi bot orqali keldi
                  </div>
                </div>
                <div className="text-right">
                  {c.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-success-container/10 text-success border border-success/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Navbatda
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" /> To'xtatilgan
                    </span>
                  )}
                  {c.suspendedReason && (
                    <div className="text-xs text-gray-500 mt-1 max-w-[220px]">{c.suspendedReason}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
