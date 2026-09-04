import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  ShieldCheck, 
  Building2, 
  Ban 
} from 'lucide-react';
import { apiFetch as fetch } from '../../lib/api';
import { LoadingState } from '../LoadingState';
import { formatDateTime } from '../../lib/formatDate';

interface AdminB2BTabProps {
  onActionToast: (message: string) => void;
}

export const AdminB2BTab: React.FC<AdminB2BTabProps> = ({ onActionToast }) => {
  const [b2bAccounts, setB2bAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchB2bAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/b2b');
      if (res.ok) {
        const data = await res.json();
        setB2bAccounts(data.b2bAccounts || []);
      }
    } catch (err) {
      console.error("Fetch B2B accounts error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchB2bAccounts();
  }, []);

  const handleVerify = async (id: string, verified: boolean) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/b2b/${id}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ verified })
      });
      if (res.ok) {
        onActionToast(verified ? "B2B hisob muvaffaqiyatli tasdiqlandi!" : "B2B hisob rad etildi.");
        fetchB2bAccounts();
      } else {
        const data = await res.json();
        onActionToast(data.error || "Xatolik yuz berdi.");
      }
    } catch (err) {
      console.error("Verify B2B error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingAccounts = b2bAccounts.filter(b => !b.verified);
  const verifiedAccounts = b2bAccounts.filter(b => b.verified);

  return (
    <div className="space-y-8">
      {/* Pending B2B Requests */}
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2">
            <Briefcase className="text-secondary w-5 h-5" />
            Tasdiqlash kutilayotgan B2B arizalar ({pendingAccounts.length})
          </h2>
          <button
            onClick={fetchB2bAccounts}
            className="px-4 py-2 bg-secondary-container/10 text-secondary-container rounded-xl font-bold text-xs hover:bg-secondary-container/20 transition-all flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container"
            aria-label="Arizalar ro'yxatini yangilash"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Yangilash
          </button>
        </div>

        {isLoading ? (
          <LoadingState variant="block" text="Arizalar yuklanmoqda..." />
        ) : pendingAccounts.length === 0 ? (
          <div className="py-12 text-center text-on-primary-container space-y-2">
            <CheckCircle className="w-10 h-10 mx-auto opacity-40 text-on-primary-container" />
            <p className="text-sm font-bold">Kutilayotgan B2B arizalar mavjud emas</p>
            <p className="text-xs">Barcha arizalar ko'rib chiqilgan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingAccounts.map((b2b) => (
              <div key={b2b.id} className="bg-surface-container-low border border-secondary/30 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-secondary-container/20 text-secondary text-xs rounded font-bold">Kutilmoqda</span>
                    <span className="text-xs text-on-primary-container font-mono">ID: {b2b.id}</span>
                  </div>
                  <h4 className="font-bold text-on-primary-container text-base">{b2b.companyName}</h4>
                  <p className="text-sm text-on-primary-container">
                    Foydalanuvchi: <span className="text-on-primary-container font-medium">{b2b.user?.name || b2b.user?.email || `User #${b2b.userId}`}</span> ({b2b.user?.email})
                  </p>
                  <div className="flex items-center gap-4 text-xs text-on-primary-container mt-1">
                    <span>Soliq ID / STIR: <strong className="text-on-primary-container font-mono">{b2b.taxId || 'Ko\'rsatilmagan'}</strong></span>
                    <span>Chegirma: <strong className="text-success">{b2b.discount}%</strong></span>
                    <span>Sana: {formatDateTime(b2b.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleVerify(b2b.id, true)}
                    disabled={updatingId === b2b.id}
                    className="px-4 py-2.5 bg-success hover:brightness-110 text-black font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-success"
                    aria-label="B2B hisobni tasdiqlash"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {updatingId === b2b.id ? "Jarayonda..." : "Tasdiqlash"}
                  </button>
                  <button
                    onClick={() => handleVerify(b2b.id, false)}
                    disabled={updatingId === b2b.id}
                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="B2B hisobni rad etish"
                  >
                    <XCircle className="w-4 h-4" />
                    Rad etish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verified B2B Accounts */}
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2">
            <ShieldCheck className="text-success w-5 h-5" />
            Tasdiqlangan B2B Hisoblar ({verifiedAccounts.length})
          </h2>
        </div>

        {isLoading ? (
          <LoadingState variant="block" text="Yuklanmoqda..." />
        ) : verifiedAccounts.length === 0 ? (
          <div className="py-12 text-center text-on-primary-container space-y-2">
            <Building2 className="w-10 h-10 mx-auto opacity-40 text-on-primary-container" />
            <p className="text-sm font-bold">Tasdiqlangan B2B hisoblar mavjud emas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {verifiedAccounts.map((b2b) => (
              <div key={b2b.id} className="bg-surface-container-low border border-success-container/30 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-success-container/25 text-success text-xs rounded font-bold">Tasdiqlangan</span>
                    <span className="text-xs text-on-primary-container font-mono">ID: {b2b.id}</span>
                  </div>
                  <h4 className="font-bold text-on-primary-container text-base">{b2b.companyName}</h4>
                  <p className="text-sm text-on-primary-container">
                    Foydalanuvchi: <span className="text-on-primary-container font-medium">{b2b.user?.name || b2b.user?.email || `User #${b2b.userId}`}</span> ({b2b.user?.email})
                  </p>
                  <div className="flex items-center gap-4 text-xs text-on-primary-container mt-1">
                    <span>Soliq ID / STIR: <strong className="text-on-primary-container font-mono">{b2b.taxId || 'Ko\'rsatilmagan'}</strong></span>
                    <span>Chegirma: <strong className="text-success">{b2b.discount}%</strong></span>
                    <span>Sana: {formatDateTime(b2b.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleVerify(b2b.id, false)}
                    disabled={updatingId === b2b.id}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Tasdiqni bekor qilish"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Bekor qilish
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
