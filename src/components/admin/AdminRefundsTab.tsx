import React, { useState, useEffect } from 'react';

interface AdminRefundsTabProps {
  escrowRefunds: any[];
  isLoadingEscrowRefunds: boolean;
  fetchEscrowRefunds: () => void;
  handleCompleteRefund: (paymentId: string) => void;
  token?: string | null;
}

export const AdminRefundsTab: React.FC<AdminRefundsTabProps> = ({
  escrowRefunds,
  isLoadingEscrowRefunds,
  fetchEscrowRefunds,
  handleCompleteRefund,
  token
}) => {
  const [pendingRewards, setPendingRewards] = useState<any[]>([]);
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);

  const fetchPendingRewards = async () => {
    setIsLoadingRewards(true);
    try {
      const res = await fetch('/api/admin/referrals/rewards-pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRewards(data);
      }
    } catch (err) {
      console.error("Fetch pending rewards error:", err);
    } finally {
      setIsLoadingRewards(false);
    }
  };

  useEffect(() => {
    fetchPendingRewards();
  }, []);

  const handleCompleteReward = async (rewardId: string) => {
    try {
      const res = await fetch(`/api/admin/referrals/rewards/${rewardId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPendingRewards();
      }
    } catch (err) {
      console.error("Complete reward error:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Escrow Refunds Section */}
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">payments</span>
            Qaytarish talab qilinadigan to'lovlar (Refund Required) ({escrowRefunds.length})
          </h2>
          <button
            onClick={fetchEscrowRefunds}
            className="px-4 py-2 bg-secondary-container/10 text-secondary-container rounded-xl font-bold text-xs hover:bg-secondary-container/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Yangilash
          </button>
        </div>

        {isLoadingEscrowRefunds ? (
          <div className="py-12 text-center text-on-primary-container text-sm">Yuklanmoqda...</div>
        ) : escrowRefunds.length === 0 ? (
          <div className="py-12 text-center text-on-primary-container space-y-2">
            <span className="material-symbols-outlined text-4xl opacity-40">task_alt</span>
            <p className="text-sm font-bold">Kutilayotgan qaytarishlar mavjud emas</p>
            <p className="text-xs">Barcha moliyaviy amaliyotlar joyida.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {escrowRefunds.map((payment) => (
              <div key={payment.id} className="bg-background border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded font-bold">Qaytarish kutilmoqda</span>
                    <span className="text-xs text-on-primary-container font-mono">ID: {payment.id}</span>
                  </div>
                  <h4 className="font-bold text-white text-base">{payment.startup?.name || 'Noma\'lum loyiha'}</h4>
                  <p className="text-sm text-on-primary-container">
                    Xaridor: <span className="text-white font-medium">{payment.user?.name || payment.user?.email || `User #${payment.userId}`}</span> ({payment.user?.email})
                  </p>
                  <div className="flex items-center gap-4 text-xs text-on-primary-container mt-1">
                    <span>Summa: <strong className="text-white">{payment.amount} {payment.currency}</strong></span>
                    <span>Sana: {new Date(payment.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleCompleteRefund(payment.id)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-md"
                  >
                    <span className="material-symbols-outlined text-xs">done_all</span>
                    Qaytarish bajarildi (CoinGate)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Referral Rewards Section (Item 4 requirement) */}
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">card_giftcard</span>
            Kutilayotgan Referral Mukofotlari (Earned/Pending Rewards) ({pendingRewards.length})
          </h2>
          <button
            onClick={fetchPendingRewards}
            className="px-4 py-2 bg-secondary-container/10 text-secondary-container rounded-xl font-bold text-xs hover:bg-secondary-container/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Yangilash
          </button>
        </div>

        {isLoadingRewards ? (
          <div className="py-12 text-center text-on-primary-container text-sm">Yuklanmoqda...</div>
        ) : pendingRewards.length === 0 ? (
          <div className="py-12 text-center text-on-primary-container space-y-2">
            <span className="material-symbols-outlined text-4xl opacity-40">redeem</span>
            <p className="text-sm font-bold">Kutilayotgan referral mukofotlari mavjud emas</p>
            <p className="text-xs">Barcha referral mukofotlari to'lab berilgan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRewards.map((reward) => (
              <div key={reward.id} className="bg-background border border-cyan-500/30 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded font-bold uppercase">{reward.status}</span>
                    <span className="text-xs text-on-primary-container font-mono">Mukofot ID: {reward.id}</span>
                  </div>
                  <h4 className="font-bold text-white text-base">Referrer: {reward.referral?.referrer?.name || 'Noma\'lum'} ({reward.referral?.referrer?.email})</h4>
                  <p className="text-sm text-on-primary-container">
                    Referral Kod: <span className="text-white font-mono">{reward.referral?.code}</span>
                  </p>
                  <div className="flex items-center gap-4 text-xs text-on-primary-container mt-1">
                    <span>Mukofot summasi: <strong className="text-emerald-400">{reward.rewardAmount}</strong></span>
                    <span>Sana: {new Date(reward.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleCompleteReward(reward.id)}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-md"
                  >
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    To'landi deb belgilash (Paid Out)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
