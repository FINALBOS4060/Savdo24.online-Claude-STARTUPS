import React, { useState, useEffect } from 'react';
import { Startup, UserProfileData, ProfileTab, Category } from '../types';
import { apiFetch as fetch } from '../lib/api';

interface ProfilePageProps {
  startups: Startup[];
  setView: (view: string, id?: string) => void;
  setSelectedStartupId: (id: string) => void;
  user: UserProfileData;
  setUser: React.Dispatch<React.SetStateAction<UserProfileData>>;
  bookmarkedIds: string[];
  onActionToast: (message: string) => void;
  activeTab: ProfileTab;
  setActiveTab: (tab: ProfileTab) => void;
  categories: Category[];
}

export default function ProfilePage({
  startups,
  setView,
  setSelectedStartupId,
  user,
  setUser,
  bookmarkedIds,
  onActionToast,
  activeTab,
  setActiveTab,
  categories,
}: ProfilePageProps) {
  const [isEditingCover, setIsEditingCover] = useState(false);

  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [earningsData, setEarningsData] = useState<{ totalEarnings: number, sales: any[] }>({ totalEarnings: 0, sales: [] });
  const [reviewsGiven, setReviewsGiven] = useState<any[]>([]);
  const [reviewsReceivedData, setReviewsReceivedData] = useState<{ reviews: any[], averageRating: number, totalReviews: number }>({ reviews: [], averageRating: 0, totalReviews: 0 });
  const [sessions, setSessions] = useState<any[]>([]);
  const [referralStats, setReferralStats] = useState<{ referralCount: number, totalEarned: number, tier: any, referrals: any[] }>({ referralCount: 0, totalEarned: 0, tier: null, referrals: [] });
  const [escrows, setEscrows] = useState<any[]>([]);
  const [b2bAccount, setB2BAccount] = useState<any>(null);

  React.useEffect(() => {
    if (activeTab === 'purchases' && user.id) {
      fetch('/api/payments/my')
      .then(res => res.json())
      .then(data => {
        if (data.payments) setMyPurchases(data.payments);
      })
      .catch(console.error);
    }

    if (activeTab === 'earnings' && user.id) {
      fetch('/api/users/me/earnings')
      .then(res => res.json())
      .then(data => {
        setEarningsData(data);
      })
      .catch(console.error);
    }

    if (activeTab === 'reviews' && user.id) {
      fetch('/api/users/me/reviews-given')
      .then(res => res.json())
      .then(data => setReviewsGiven(data))
      .catch(console.error);

      fetch('/api/users/me/reviews-received')
      .then(res => res.json())
      .then(data => setReviewsReceivedData(data))
      .catch(console.error);
    }

    if (activeTab === 'security' && user.id) {
      fetch('/api/auth/sessions')
      .then(res => res.json())
      .then(data => {
        setSessions(data);
      })
      .catch(console.error);
    }

    if (activeTab === 'referral' && user.id) {
      fetch('/api/referrals/my-stats')
      .then(res => res.json())
      .then(data => setReferralStats(data))
      .catch(console.error);
    }

    if (activeTab === 'purchases' && user.id) {
      fetch('/api/escrow/my-purchases')
      .then(res => res.json())
      .then(data => setEscrows(data))
      .catch(console.error);
    }

    if (activeTab === 'b2b' && user.id) {
      fetch('/api/b2b/profile')
      .then(res => res.json())
      .then(data => setB2BAccount(data))
      .catch(console.error);
    }
  }, [activeTab, user.id]);

  const revokeSession = async (id: number) => {
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        onActionToast("Sessiya muvaffaqiyatli yakunlandi.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const revokeAllSessions = async () => {
    try {
      const res = await fetch('/api/auth/sessions', { method: 'DELETE' });
      if (res.ok) {
        setSessions([]);
        onActionToast("Barcha sessiyalar yakunlandi.");
      }
    } catch (err) {
      console.error(err);
    }
  };


  // Settings form states
  const [editName, setEditName] = useState(user.name);
  const [editRole, setEditRole] = useState(user.role);
  const [editAvatar, setEditAvatar] = useState(user.avatarUrl);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [topModal, setTopModal] = useState<{ isOpen: boolean; startupId: string | null; startupName: string }>({ isOpen: false, startupId: null, startupName: '' });
  const [boostDays, setBoostDays] = useState(7);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [vipDays, setVipDays] = useState(30);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const generateLinkCode = async () => {
    try {
      const res = await fetch('/api/users/me/telegram-link-code', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLinkCode(data.code);
      }
    } catch (err) {
      console.error("Generate link code error:", err);
    }
  };

  useEffect(() => {
    if (topModal.isOpen) {
      fetch(`/api/top-boost/price?days=${boostDays}`)
        .then(res => res.json())
        .then(data => setEstimatedPrice(data.price));
    }
  }, [boostDays, topModal.isOpen]);

  const handleBuyTop = async () => {
    try {
      const res = await fetch('/api/top-boost/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startupId: topModal.startupId, days: boostDays })
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.paymentUrl;
      }
    } catch (err) {
      console.error("TOP boost error:", err);
    }
  };

  const handleBuyVip = async () => {
    try {
      const res = await fetch('/api/vip/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: vipDays })
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.paymentUrl;
      }
    } catch (err) {
      console.error("VIP subscription error:", err);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        // FormData handles headers
      });

      if (res.ok) {
        const data = await res.json();
        setEditAvatar(data.url);
        // Automatically save to profile
        await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarUrl: data.url })
        });
      } else {
        const errData = await res.json();
        alert(errData.error || "Rasm yuklashda xatolik.");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  React.useEffect(() => {
    setEditName(user.name);
    setEditRole(user.role);
    setEditAvatar(user.avatarUrl);
  }, [user]);

  // If the user is logged in (has an id), show only startups matching their userId.
  // Otherwise, fallback to showing the default seeded portfolio.
  const myStartups = user.id
    ? startups.filter((s: any) => s.userId === user.id)
    : startups.filter(
        (s) =>
          s.id === 'quantumpay-ai' ||
          s.id === 'greenlogistics' ||
          s.id === 'retroarcade-io' ||
          (!['ecoflow-systems', 'neuralpath-ai', 'greenhorizon', 'pulsemetrics'].includes(s.id) && s.id !== 'ecoflow-systems')
      );

  const savedStartups = startups.filter((s) => bookmarkedIds.includes(s.id));

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setUser((prev) => ({
      ...prev,
      name: editName,
      role: editRole,
      avatarUrl: editAvatar,
    }));
    onActionToast('Profil sozlamalari muvaffaqiyatli saqlandi!');
  };

  const handleCardClick = (id: string) => {
    setSelectedStartupId(id);
    setView('detail');
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Profile Header Section */}
      <header className="relative mb-10 bg-primary-container border border-outline-variant/20 rounded-2xl overflow-hidden pb-6">
        <div className="h-48 w-full bg-gradient-to-br from-[#131b2e] to-[#0b1426] relative overflow-hidden flex items-center justify-center">
          {/* Subtle network connection pattern overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fdc338_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1426] to-transparent"></div>
          <button
            onClick={() => {
              setIsEditingCover(!isEditingCover);
              onActionToast('Muqova rasmi dinamik ravishda yangilandi.');
            }}
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white border border-white/20 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-sm">photo_camera</span>
            Bannerni tahrirlash
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-12 px-6 gap-6 relative z-10">
          <div className="relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-primary-container overflow-hidden shadow-2xl bg-[#0b1426]">
              <img
                className="w-full h-full object-cover"
                src={user.avatarUrl}
                alt={`${user.name} profil avatari`}
                loading="lazy"
                width={160}
                height={160}
              />
            </div>
            <div className="absolute bottom-2 right-2 w-8 h-8 bg-secondary-container rounded-full flex items-center justify-center border-4 border-[#0b1426] shadow-lg">
              <span className="material-symbols-outlined text-on-secondary-fixed text-sm font-bold">verified</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col md:flex-row justify-between items-center md:items-end w-full text-center md:text-left">
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2 justify-center md:justify-start">
                {user.name}
              </h1>
              <div className="flex items-center gap-2 mt-1 justify-center md:justify-start">
                <span className="px-3 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-bold text-xs uppercase tracking-wide">
                  {user.role}
                </span>
                <span className="text-on-primary-container text-xs">• A'zo bo'lgan sanasi: {user.joinDate}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('settings')}
                className="px-5 py-2 border border-outline-variant/40 rounded-xl font-bold text-xs hover:bg-white/5 text-white transition-all active:scale-95"
              >
                Profilni tahrirlash
              </button>
              <button
                onClick={() => setView('sell')}
                className="px-5 py-2 bg-secondary-container text-on-secondary-fixed rounded-xl font-bold text-xs shadow-lg shadow-secondary-container/20 hover:brightness-110 active:scale-95 transition-all"
              >
                G'oya e'lon qilish
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Tabs */}
      <div className="flex border-b border-outline-variant/20 mb-8 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('startups')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'startups'
              ? 'text-secondary-container border-secondary-container'
              : 'text-on-primary-container border-transparent hover:text-secondary-container'
          }`}
        >
          <span className="material-symbols-outlined text-lg">rocket_launch</span>
          Mening loyihalarim va g'oyalarim
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'saved'
              ? 'text-secondary-container border-secondary-container'
              : 'text-on-primary-container border-transparent hover:text-secondary-container'
          }`}
        >
          <span className="material-symbols-outlined text-lg">bookmark</span>
          Saqlanganlar ({savedStartups.length})
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'purchases'
              ? 'text-secondary-container border-secondary-container'
              : 'text-on-primary-container border-transparent hover:text-secondary-container'
          }`}
        >
          <span className="material-symbols-outlined text-lg">shopping_cart</span>
          Xaridlarim
        </button>
        <button
          onClick={() => setActiveTab('earnings')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'earnings'
              ? 'text-secondary-container border-secondary-container'
              : 'text-on-primary-container border-transparent hover:text-secondary-container'
          }`}
        >
          <span className="material-symbols-outlined text-lg">payments</span>
          Daromadlarim
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'reviews'
              ? 'text-secondary-container border-secondary-container'
              : 'text-on-primary-container border-transparent hover:text-secondary-container'
          }`}
        >
          <span className="material-symbols-outlined text-lg">reviews</span>
          Sharhlarim
        </button>
        <button
          onClick={() => setActiveTab('referral')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'referral'
              ? 'text-emerald-400 border-emerald-400'
              : 'text-on-primary-container border-transparent hover:text-emerald-400'
          }`}
        >
          <span className="material-symbols-outlined text-lg">group_add</span>
          Referral
        </button>
        <button
          onClick={() => setActiveTab('b2b')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'b2b'
              ? 'text-blue-400 border-blue-400'
              : 'text-on-primary-container border-transparent hover:text-blue-400'
          }`}
        >
          <span className="material-symbols-outlined text-lg">business</span>
          B2B Wholesale
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'settings'
              ? 'text-secondary-container border-secondary-container'
              : 'text-on-primary-container border-transparent hover:text-secondary-container'
          }`}
        >
          <span className="material-symbols-outlined text-lg">settings</span>
          Sozlamalar
        </button>
        <button
          onClick={() => setActiveTab('vip')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'vip'
              ? 'text-yellow-400 border-yellow-400'
              : 'text-on-primary-container border-transparent hover:text-yellow-400'
          }`}
        >
          <span className="material-symbols-outlined text-lg">workspace_premium</span>
          VIP a'zolik
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'security'
              ? 'text-secondary-container border-secondary-container'
              : 'text-on-primary-container border-transparent hover:text-secondary-container'
          }`}
        >
          <span className="material-symbols-outlined text-lg">shield</span>
          Xavfsizlik
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'b2b' && (
        <section className="space-y-8 animate-fade-in">
          <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-8 text-center space-y-6">
            <span className="material-symbols-outlined text-6xl text-blue-400">corporate_fare</span>
            <h3 className="text-2xl font-black text-white">Savdo24 B2B — Kompaniyalar uchun maxsus imkoniyatlar</h3>
            <p className="text-on-primary-container max-w-2xl mx-auto text-sm leading-relaxed">
              B2B hisob orqali siz ulgurji xaridlar uchun <b>20% gacha chegirma</b>, korporativ hisob-faktura va 
              shaxsiy menejer xizmatlaridan foydalanishingiz mumkin.
            </p>

            {b2bAccount ? (
              <div className="bg-[#0b1426] border border-outline-variant/20 rounded-2xl p-6 text-left max-w-xl mx-auto space-y-4">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-on-primary-container text-xs font-bold uppercase">Kompaniya:</span>
                  <span className="text-white font-bold">{b2bAccount.companyName}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-on-primary-container text-xs font-bold uppercase">Holati:</span>
                  <span className={`text-xs font-black uppercase ${b2bAccount.verified ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {b2bAccount.verified ? 'Tasdiqlangan' : 'Tekshirilmoqda'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-on-primary-container text-xs font-bold uppercase">Ulgurji chegirma:</span>
                  <span className="text-blue-400 font-bold">{b2bAccount.discount}%</span>
                </div>
              </div>
            ) : (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const res = await fetch('/api/b2b/onboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      companyName: formData.get('companyName'),
                      taxId: formData.get('taxId')
                    })
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setB2BAccount(data);
                    onActionToast("B2B so'rovingiz qabul qilindi!");
                  }
                }}
                className="max-w-md mx-auto space-y-4 bg-[#0b1426] p-8 rounded-2xl border border-outline-variant/20"
              >
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-on-primary-container uppercase">Kompaniya nomi</label>
                  <input name="companyName" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-400" placeholder="MCHJ ..." />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-on-primary-container uppercase">STIR (INN) / Soliq ID</label>
                  <input name="taxId" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-400" placeholder="123456789" />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-500 text-black font-black rounded-xl hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/20">
                  B2B a'zolik so'rovini yuborish
                </button>
              </form>
            )}
          </div>
        </section>
      )}
      {activeTab === 'referral' && (
        <section className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-emerald-400 mb-2">military_tech</span>
              <p className="text-xs text-on-primary-container uppercase font-bold">Darajangiz</p>
              <p className="text-xl font-black text-white">{referralStats.tier?.badge || 'Yangi'}</p>
              <p className="text-[10px] text-emerald-400 font-bold">Commission: {referralStats.tier?.commission}%</p>
            </div>
            <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-emerald-400 mb-2">group</span>
              <p className="text-xs text-on-primary-container uppercase font-bold">Referallar</p>
              <p className="text-3xl font-black text-white">{referralStats.referralCount}</p>
            </div>
            <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-emerald-400 mb-2">monetization_on</span>
              <p className="text-xs text-on-primary-container uppercase font-bold">Mukofot</p>
              <p className="text-3xl font-black text-white">${referralStats.totalEarned.toLocaleString()}</p>
            </div>
            <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-emerald-400 mb-2">share</span>
              <p className="text-xs text-on-primary-container uppercase font-bold">Referal kod</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <code className="bg-white/5 px-3 py-1 rounded text-emerald-400 font-mono font-bold">
                  {referralStats.referrals[0]?.code || '...'}
                </code>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(referralStats.referrals[0]?.code || '');
                    onActionToast('Referal kod nusxalandi!');
                  }}
                  className="text-white hover:text-emerald-400"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-8 text-center space-y-6">
            <h3 className="text-xl font-black text-white">Do'stlaringizni taklif qiling va daromad oling!</h3>
            <p className="text-on-primary-container max-w-xl mx-auto text-sm leading-relaxed">
              Sizning referral kodingiz orqali xarid qilgan foydalanuvchilar <b>{referralStats.tier?.discount || 5}% chegirma</b> oladi, 
              siz esa xarid summasidan <b>{referralStats.tier?.commission || 5}% mukofot</b> olasiz.
            </p>
            
            {!referralStats.referrals.length && (
              <button 
                onClick={async () => {
                  const res = await fetch('/api/referrals/generate', { method: 'POST' });
                  if (res.ok) {
                    const data = await res.json();
                    setReferralStats(prev => ({ ...prev, referrals: [{ code: data.code, isActive: true }] }));
                    onActionToast('Referal kod yaratildi!');
                  }
                }}
                className="px-8 py-4 bg-emerald-500 text-black font-black rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                Referal kod yaratish
              </button>
            )}

            {referralStats.referrals.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs text-on-primary-container">Referal havolangiz:</p>
                <div className="flex max-w-lg mx-auto bg-[#0b1426] rounded-xl overflow-hidden border border-outline-variant/20">
                  <input 
                    readOnly 
                    value={`${window.location.origin}/browse?ref=${referralStats.referrals[0].code}`}
                    className="flex-1 bg-transparent px-4 py-3 text-xs text-on-primary-container outline-none"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/browse?ref=${referralStats.referrals[0].code}`);
                      onActionToast('Havola nusxalandi!');
                    }}
                    className="bg-emerald-500 text-black px-6 font-bold text-xs"
                  >
                    Nusxalash
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      {activeTab === 'startups' && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {myStartups.map((startup) => {
            // Pick colors and details based on listing status
            const isActive = startup.status === 'active';
            const isPending = startup.status === 'pending';
            const isSold = startup.soldStatus === 'sotildi';

            const statusClass = isActive && !isSold
              ? 'status-chip-active'
              : isPending
              ? 'status-chip-pending'
              : 'status-chip-sold';

            const statusLabel = isActive && !isSold
              ? 'Faol'
              : isPending
              ? 'Tekshirilmoqda'
              : 'Sotildi';

            const materialIcon =
              startup.category === 'Fintech'
                ? 'terminal'
                : startup.category === 'Logistics'
                ? 'eco'
                : startup.category === 'E-commerce'
                ? 'sports_esports'
                : 'rocket_launch';

            return (
              <div
                key={startup.id}
                onClick={() => startup.id !== 'greenlogistics' && handleCardClick(startup.id)}
                className={`glass-card rounded-2xl p-6 hover:shadow-2xl transition-all duration-300 group border border-outline-variant/10 flex flex-col justify-between min-h-[320px] ${
                  isSold ? 'opacity-70 hover:opacity-100 grayscale hover:grayscale-0' : 'cursor-pointer hover:-translate-y-1'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-xl bg-secondary-fixed/10 flex items-center justify-center border border-secondary-fixed/20 text-secondary-container">
                      <span className="material-symbols-outlined">{materialIcon}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold mb-2 group-hover:text-secondary-container transition-colors text-white flex items-center gap-2">
                    {startup.name}
                    {startup.isTop && (
                      <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">vertical_align_top</span>
                        TOP
                      </span>
                    )}
                  </h3>
                  
                  <p className="text-xs text-on-primary-container line-clamp-3 leading-relaxed mb-6">
                    {startup.description}
                  </p>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[9px] uppercase tracking-wider text-on-tertiary-container font-extrabold mb-1">
                        Sotish narxi
                      </p>
                      <p className="font-mono text-xs font-bold text-white">${startup.price ? startup.price.toLocaleString() : "0"}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[9px] uppercase tracking-wider text-on-tertiary-container font-extrabold mb-1">
                        E'lon turi
                      </p>
                      <p className="font-mono text-xs font-bold text-white leading-tight">{startup.listingType || "To'liq loyiha (manba kodi bilan)"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setView('edit-startup', startup.id);
                      }}
                      className="flex-1 py-2 bg-blue-400/10 border border-blue-400/30 hover:bg-blue-400/20 text-blue-400 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1.5"
                    >
                      Tahrirlash
                    </button>
                    {isActive ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTopModal({ isOpen: true, startupId: startup.id, startupName: startup.name });
                          }}
                          className="flex-1 py-2 bg-yellow-400/10 border border-yellow-400/30 hover:bg-yellow-400/20 text-yellow-400 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-xs">vertical_align_top</span>
                          TOP qilish
                        </button>
                        <div className="flex -space-x-2">
                          <div className="w-6 h-6 rounded-full border-2 border-[#0b1426] bg-slate-600"></div>
                          <div className="w-6 h-6 rounded-full border-2 border-[#0b1426] bg-slate-400"></div>
                          <div className="w-6 h-6 rounded-full border-2 border-[#0b1426] bg-slate-200 flex items-center justify-center text-[8px] text-black font-extrabold">
                            +4
                          </div>
                        </div>
                        <span className="text-xs font-bold text-secondary-container">12 ta taklif</span>
                      </>
                    ) : isPending ? (
                      <>
                        <span className="text-xs text-on-tertiary-container italic">Tekshirilmoqda...</span>
                        <span className="text-xs font-bold text-on-primary-container">Taxminan 24 soat</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-secondary-container">Muvaffaqiyatli chiqish</span>
                        <span className="material-symbols-outlined text-on-primary-container text-sm leading-none">
                          arrow_forward
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Dotted Launcher card */}
          <div
            onClick={() => setView('sell')}
            className="border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center p-8 hover:bg-white/5 hover:border-secondary-container/50 transition-all group cursor-pointer min-h-[320px] text-center"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-secondary-container/10 transition-all">
              <span className="material-symbols-outlined text-secondary-container text-3xl group-hover:rotate-90 transition-transform duration-300">
                add
              </span>
            </div>
            <h4 className="text-lg font-bold text-white mb-2 group-hover:text-secondary-container transition-colors">
              Yangi e'lon
            </h4>
            <p className="text-xs text-on-primary-container max-w-[200px] leading-relaxed">
              Loyihangizni 5000 dan ortiq tasdiqlangan xaridorlarga taqdim eting.
            </p>
          </div>
        </section>
      )}

      {activeTab === 'vip' && (
        <section className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-yellow-400/10 border border-yellow-400/20 rounded-3xl mx-auto flex items-center justify-center text-yellow-400">
              <span className="material-symbols-outlined text-4xl">workspace_premium</span>
            </div>
            <h2 className="text-3xl font-black text-white">VIP A'zolik</h2>
            <p className="text-on-primary-container">
              Eksklyuziv imkoniyatlar va chegirmalarga ega bo'ling.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="glass-card p-6 rounded-2xl border-yellow-400/20 bg-yellow-400/5 relative overflow-hidden">
              <div className="relative z-10 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">done</span>
                    </span>
                    <p className="text-sm text-white">Ismingiz yonida 👑 VIP belgisi</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">done</span>
                    </span>
                    <p className="text-sm text-white">Rasmlarni yuklashda 6MB gacha limit (oddiyda 2MB)</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">done</span>
                    </span>
                    <p className="text-sm text-white">Yangi loyihalarni birinchi bo'lib ko'rish imkoniyati</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-on-primary-container mb-1">Muddati tanlang (kun)</p>
                      <input 
                        type="number" 
                        value={vipDays} 
                        onChange={(e) => setVipDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-yellow-400/50 outline-none"
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-on-primary-container mb-1">Jami (40% chegirma bilan)</p>
                      <p className="text-3xl font-black text-yellow-400">
                        ${Math.round(vipDays * 0.5 * 0.6 * 100) / 100}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={handleBuyVip}
                    className="w-full py-4 bg-yellow-400 text-black font-black rounded-xl hover:brightness-110 transition-all shadow-lg shadow-yellow-400/20 active:scale-[0.98]"
                  >
                    👑 VIP bo'lish
                  </button>
                </div>
              </div>
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-yellow-400/10 blur-[100px] rounded-full"></div>
            </div>
          </div>
        </section>
      )}

      {/* TOP Boost Modal */}
      {topModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-md p-8 rounded-3xl border-secondary-container/30 space-y-6 shadow-2xl relative overflow-hidden">
            <button 
              onClick={() => setTopModal({ ...topModal, isOpen: false })}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-secondary-container">vertical_align_top</span>
              <h3 className="text-2xl font-black text-white">Elonni TOPga chiqarish</h3>
              <p className="text-xs text-on-primary-container">"{topModal.startupName}"</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-on-primary-container mb-2 block">Kunlar soni</label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 7, 14, 30].map(d => (
                    <button 
                      key={d}
                      onClick={() => setBoostDays(d)}
                      className={`py-2 rounded-xl border font-bold text-xs transition-all ${
                        boostDays === d 
                          ? 'bg-secondary-container text-on-secondary-fixed border-secondary-container' 
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      {d} kun
                    </button>
                  ))}
                </div>
                <input 
                  type="number"
                  value={boostDays}
                  onChange={(e) => setBoostDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-secondary-container outline-none"
                  placeholder="Boshqa kun..."
                />
              </div>

              <div className="bg-secondary-container/5 p-4 rounded-2xl border border-secondary-container/20">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-on-primary-container">Hisoblangan narx:</span>
                  <span className="text-2xl font-black text-secondary-container">${estimatedPrice}</span>
                </div>
                <p className="text-[9px] text-on-primary-container mt-2 leading-tight">
                  * Narx joriy talab (aktiv TOP elonlar soni) asosida dinamik ravishda hisoblanadi.
                </p>
              </div>

              <button 
                onClick={handleBuyTop}
                className="w-full py-4 bg-secondary-container text-on-secondary-fixed font-black rounded-xl hover:brightness-110 transition-all shadow-lg shadow-secondary-container/20 active:scale-[0.98]"
              >
                🔝 To'lovga o'tish
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'saved' && (
        <section className="space-y-6">
          {savedStartups.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-outline-variant/20 rounded-2xl bg-white/5">
              <span className="material-symbols-outlined text-4xl text-on-primary-container mb-3">bookmark_border</span>
              <p className="text-on-primary-container font-semibold">Hozircha saqlangan e'lonlar yo'q.</p>
              <button
                onClick={() => setView('browse')}
                className="text-secondary-container font-bold text-sm underline mt-2"
              >
                Xatcho'p qo'shish uchun startaplarni ko'rib chiqing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {savedStartups.map((startup) => (
                <div
                  key={startup.id}
                  className="bg-primary-container border border-outline-variant/20 rounded-2xl overflow-hidden hover:shadow-xl transition-all group flex flex-col justify-between h-[380px]"
                >
                  <div className="h-40 relative overflow-hidden bg-white/5">
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      src={startup.image}
                      alt={`${startup.name} - saqlangan loyiha muqovasi`}
                      loading="lazy"
                      width={320}
                      height={160}
                    />
                    <div className="absolute top-4 left-4 bg-primary-container/95 text-white border border-white/10 px-3 py-1 rounded-lg text-xs font-bold uppercase">
                      {categories.find(c => c.id === startup.category)?.name || startup.category}
                    </div>
                  </div>

                  <div className="p-5 flex-grow flex flex-col justify-between">
                    <div>
                      <h4
                        onClick={() => handleCardClick(startup.id)}
                        className="font-extrabold text-white text-base hover:text-secondary-container transition-colors cursor-pointer"
                      >
                        {startup.name}
                      </h4>
                      <p className="text-xs text-on-primary-container line-clamp-2 mt-1">
                        {startup.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-on-primary-container uppercase block">Sotish narxi</span>
                        <span className="text-sm font-bold text-secondary-container font-mono">
                          ${startup.price ? startup.price.toLocaleString() : "Kelishilgan holda"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCardClick(startup.id)}
                        className="px-4 py-2 bg-white/5 hover:bg-secondary-container hover:text-on-secondary-fixed text-white font-bold text-xs rounded-lg transition-colors"
                      >
                        Ko'rish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'purchases' && (
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
                <div key={payment.id} className="bg-[#0b1426] border border-outline-variant/20 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-outline-variant/40 transition-colors">
                  <div>
                    <h4 className="font-bold text-white text-lg">{payment.startup?.name || 'Noma\'lum loyiha'}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-on-primary-container">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">payments</span>{payment.amount} {payment.currency}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">calendar_today</span>{new Date(payment.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {payment.startup && payment.startup.deliveryUrl ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a
                        href={payment.startup.deliveryUrl} target="_blank" rel="noreferrer"
                        className="px-4 py-2 bg-secondary-container/10 text-secondary-container hover:bg-secondary-container/20 rounded-lg font-bold text-sm whitespace-nowrap transition-colors border border-secondary-container/20 text-center"
                      >
                        Loyihani yuklash
                      </a>
                      {escrows.find(e => e.paymentId === payment.id)?.status === 'held' && (
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const res = await fetch('/api/escrow/release', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ paymentId: payment.id })
                              });
                              if (res.ok) {
                                onActionToast("Mablag' ozod qilindi!");
                                setEscrows(prev => prev.map(e => e.paymentId === payment.id ? { ...e, status: 'released' } : e));
                              }
                            }}
                            className="px-4 py-2 bg-emerald-500 text-black rounded-lg font-bold text-sm"
                          >
                            Tasdiqlash
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt("Nizo sababini yozing:");
                              if (reason) {
                                  fetch('/api/escrow/dispute', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ paymentId: payment.id, reason })
                                  }).then(async (res) => {
                                    const data = await res.json();
                                    onActionToast(data.message || data.error);
                                    if (res.ok) setEscrows(prev => prev.map(e => e.paymentId === payment.id ? { ...e, status: 'disputed' } : e));
                                  });
                              }
                            }}
                            className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg font-bold text-sm"
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
                      className="px-4 py-2 bg-secondary-container/10 text-secondary-container hover:bg-secondary-container/20 rounded-lg font-bold text-sm whitespace-nowrap transition-colors border border-secondary-container/20"
                    >
                      Loyihani ko'rish (Aloqa kutilmoqda)
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'earnings' && (
        <section className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
          <div className="mb-8 text-center md:text-left">
            <h3 className="text-sm font-bold text-on-primary-container uppercase tracking-wider mb-2">Jami daromad</h3>
            <p className="text-4xl font-extrabold text-white">${earningsData.totalEarnings.toLocaleString()}</p>
          </div>

          <h3 className="text-lg font-bold text-white border-b border-outline-variant/15 pb-4 mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary-container">history</span>
            Yakunlangan savdolar ro'yxati
          </h3>
          
          {earningsData.sales.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-outline-variant/20 rounded-2xl">
              <p className="text-on-primary-container font-medium">Hozircha daromadlar yo'q</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/10">
                    <th className="py-4 px-4 text-xs font-bold text-on-primary-container uppercase">Sana</th>
                    <th className="py-4 px-4 text-xs font-bold text-on-primary-container uppercase">Loyiha nomi</th>
                    <th className="py-4 px-4 text-xs font-bold text-on-primary-container uppercase">Savdo summasi</th>
                    <th className="py-4 px-4 text-xs font-bold text-on-primary-container uppercase">Sof daromad</th>
                  </tr>
                </thead>
                <tbody>
                  {earningsData.sales.map((sale: any) => (
                    <tr key={sale.id} className="border-b border-outline-variant/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 text-sm text-white">{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="py-4 px-4 text-sm font-bold text-white">{sale.projectName}</td>
                      <td className="py-4 px-4 text-sm text-on-primary-container">${sale.amount.toLocaleString()}</td>
                      <td className="py-4 px-4 text-sm font-bold text-emerald-400">+${sale.payout.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'reviews' && (
        <section className="space-y-8">
          <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary-container">star</span>
                Menga yozilgan sharhlar
              </h3>
              <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                <span className="text-sm font-bold text-white">O'rtacha reyting:</span>
                <span className="text-lg font-extrabold text-[#f0b90b]">{reviewsReceivedData.averageRating.toFixed(1)}</span>
                <div className="flex text-[#f0b90b]">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className="material-symbols-outlined text-sm">
                      {star <= Math.round(reviewsReceivedData.averageRating) ? 'star' : 'star_outline'}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-on-primary-container">({reviewsReceivedData.totalReviews} ta)</span>
              </div>
            </div>

            {reviewsReceivedData.reviews.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-outline-variant/20 rounded-2xl">
                <p className="text-on-primary-container font-medium">Hozircha sharhlar yo'q</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviewsReceivedData.reviews.map((review: any) => (
                  <div key={review.id} className="bg-[#0b1426] border border-outline-variant/10 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={review.buyer?.avatarUrl} 
                          className="w-10 h-10 rounded-full border border-outline-variant/20" 
                          alt={`${review.buyer?.name || 'Xaridor'} avatari`}
                          loading="lazy"
                          width={40}
                          height={40}
                        />
                        <div>
                          <p className="text-sm font-bold text-white">{review.buyer?.name}</p>
                          <p className="text-[10px] text-on-primary-container">{new Date(review.createdAt).toLocaleDateString()} • {review.startup?.name}</p>
                        </div>
                      </div>
                      <div className="flex text-[#f0b90b]">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className="material-symbols-outlined text-sm">
                            {star <= review.rating ? 'star' : 'star_outline'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-on-primary-container leading-relaxed italic">"{review.comment}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-container">rate_review</span>
              Men yozgan sharhlar
            </h3>

            {reviewsGiven.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-outline-variant/20 rounded-2xl">
                <p className="text-on-primary-container font-medium">Siz hali sharh yozmagansiz</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviewsGiven.map((review: any) => (
                  <div key={review.id} className="bg-[#0b1426] border border-outline-variant/10 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-bold text-white">{review.startup?.name}</p>
                        <p className="text-[10px] text-on-primary-container">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex text-[#f0b90b]">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className="material-symbols-outlined text-sm">
                            {star <= review.rating ? 'star' : 'star_outline'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-on-primary-container leading-relaxed italic">"{review.comment}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'settings' && (

        <section className="max-w-xl bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-outline-variant/15 pb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-container">person</span>
              Profil sozlamalarini tahrirlash
            </h3>

            <div className="flex flex-col items-center gap-4 py-4">
              <div 
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-24 h-24 rounded-full border-4 border-secondary-container/20 overflow-hidden bg-[#0b1426] flex items-center justify-center">
                  {isUploadingAvatar ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-secondary-container border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[10px] font-bold text-secondary-container">Yuklanmoqda...</span>
                    </div>
                  ) : (
                    <img 
                      src={editAvatar} 
                      alt="Profil rasmini yangilash - yangi rasm tanlash" 
                      className="w-full h-full object-cover group-hover:opacity-50 transition-all" 
                      loading="lazy"
                      width={96}
                      height={96}
                    />
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <span className="material-symbols-outlined text-white text-3xl">edit</span>
                </div>
                {user.isVip && (
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-black border-4 border-primary-container shadow-lg">
                    <span className="material-symbols-outlined text-lg">workspace_premium</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] font-bold text-on-primary-container uppercase tracking-widest">Profil rasmini o'zgartirish</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-primary-container block">To'liq ism</label>
              <input
                type="text"
                className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-lg p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-all"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-primary-container block">Sotuvchi/Xaridor roli</label>
              <select
                className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-lg p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-all appearance-none"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                <option value="Buyer">Xaridor</option>
                <option value="Seller">Sotuvchi</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-secondary-container text-on-secondary-fixed rounded-xl font-bold text-sm shadow-lg shadow-secondary-container/10 hover:brightness-110 active:scale-95 transition-all"
            >
              Sozlamalarni saqlash
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-outline-variant/15 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-container text-lg">robot_2</span>
              Telegram botni ulash
            </h4>
            <p className="text-xs text-on-primary-container leading-relaxed">
              Botni ulash orqali siz mahsulotlarni bevosita Telegram orqali sotib olishingiz va to'lovdan so'ng darhol yetkazish havolasini olishingiz mumkin.
            </p>
            
            {linkCode ? (
              <div className="bg-[#0b1426] border border-secondary-container/30 rounded-xl p-4 text-center space-y-2 animate-pulse-subtle">
                <p className="text-[10px] uppercase font-bold text-on-primary-container">Sizning ulanish kodingiz:</p>
                <p className="text-2xl font-mono font-bold text-secondary-container tracking-widest">{linkCode}</p>
                <p className="text-[10px] text-on-primary-container">
                  Botga o'ting va ushbu buyruqni yuboring: <br/>
                  <code className="bg-white/5 px-1 py-0.5 rounded">/bogla {linkCode}</code>
                </p>
              </div>
            ) : (
              <button
                onClick={generateLinkCode}
                className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">link</span>
                Ulanish kodi olish
              </button>
            )}
          </div>
        </section>
      )}

      {activeTab === 'security' && (
        <section className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-container">shield</span>
              Faol sessiyalar
            </h3>
            {sessions.length > 1 && (
              <button
                onClick={revokeAllSessions}
                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl font-bold text-xs transition-all"
              >
                Barcha sessiyalarni yakunlash
              </button>
            )}
          </div>

          <div className="space-y-4">
            {sessions.length === 0 ? (
              <p className="text-center py-8 text-on-primary-container text-sm italic">Sessiyalar topilmadi.</p>
            ) : (
              sessions.map(session => (
                <div key={session.id} className="bg-[#0b1426] border border-outline-variant/10 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-secondary-container">
                      <span className="material-symbols-outlined text-2xl">
                        {session.userAgent?.toLowerCase().includes('mobile') ? 'smartphone' : 'desktop_windows'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {session.userAgent || "Noma'lum qurilma"}
                      </p>
                      <p className="text-[10px] text-on-primary-container mt-0.5">
                        IP: {session.ip} • Oxirgi faollik: {new Date(session.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => revokeSession(session.id)}
                    className="px-4 py-2 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg font-bold text-[11px] transition-colors"
                  >
                    Sessiyani yakunlash
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
