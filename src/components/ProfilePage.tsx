import React, { useState, useEffect } from 'react';
import { Startup, UserProfileData, ProfileTab, Category } from '../types';
import { apiFetch as fetch } from '../lib/api';
import { ProfileReferralsTab } from './profile/ProfileReferralsTab';
import { ProfileB2BTab } from './profile/ProfileB2BTab';
import { ProfileStartupsTab } from './profile/ProfileStartupsTab';
import { ProfileVipTab } from './profile/ProfileVipTab';
import { ProfileSavedTab } from './profile/ProfileSavedTab';
import { ProfilePurchasesTab } from './profile/ProfilePurchasesTab';
import { ProfileEarningsTab } from './profile/ProfileEarningsTab';
import { ProfileReviewsTab } from './profile/ProfileReviewsTab';
import { ProfileSettingsTab } from './profile/ProfileSettingsTab';
import { ProfileSecurityTab } from './profile/ProfileSecurityTab';

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
    if (!user.id) return;

    let isMounted = true;

    const loadTabData = async () => {
      try {
        switch (activeTab) {
          case 'purchases':
            // Fetch both payments and escrows in parallel
            const [paymentsRes, escrowRes] = await Promise.all([
              fetch('/api/payments/my'),
              fetch('/api/escrow/my-purchases')
            ]);
            
            if (paymentsRes.ok && isMounted) {
              const data = await paymentsRes.json();
              setMyPurchases(data.payments || []);
            }
            
            if (escrowRes.ok && isMounted) {
              const data = await escrowRes.json();
              setEscrows(data || []);
            }
            break;

          case 'earnings':
            const earningsRes = await fetch('/api/users/me/earnings');
            if (earningsRes.ok && isMounted) {
              setEarningsData(await earningsRes.json());
            }
            break;

          case 'reviews':
            const [givenRes, receivedRes] = await Promise.all([
              fetch('/api/users/me/reviews-given'),
              fetch('/api/users/me/reviews-received')
            ]);
            
            if (givenRes.ok && isMounted) {
              setReviewsGiven(await givenRes.json());
            }
            if (receivedRes.ok && isMounted) {
              setReviewsReceivedData(await receivedRes.json());
            }
            break;

          case 'security':
            const sessionsRes = await fetch('/api/auth/sessions');
            if (sessionsRes.ok && isMounted) {
              setSessions(await sessionsRes.json());
            }
            break;

          case 'referral':
            const refRes = await fetch('/api/referrals/my-stats');
            if (refRes.ok && isMounted) {
              setReferralStats(await refRes.json());
            }
            break;

          case 'b2b':
            const b2bRes = await fetch('/api/b2b/profile');
            if (b2bRes.ok && isMounted) {
              setB2BAccount(await b2bRes.json());
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error(`Error loading ${activeTab} data:`, err);
      }
    };

    loadTabData();

    return () => {
      isMounted = false;
    };
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
  const [vipEstimatedPrice, setVipEstimatedPrice] = useState(0);
  const [vipDiscountPercent, setVipDiscountPercent] = useState(40);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  // 83-band: Sozlamalar/B2B formalarida submit paytida disabled/loading
  // holati yo'q edi (SellPage/SupportPage/MessagesPage'dagi 60/74/76-band
  // bilan bir xil muammo turi).
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSubmittingB2B, setIsSubmittingB2B] = useState(false);
  // 120-band: TOP/VIP xarid va escrow tugmalarida ham xuddi shu turdagi
  // himoya yo'q edi (60/74/76/83/84/117/118/119-band naqshi).
  const [isBuyingTop, setIsBuyingTop] = useState(false);
  const [isBuyingVip, setIsBuyingVip] = useState(false);
  const [escrowActionId, setEscrowActionId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  const generateLinkCode = async () => {
    try {
      const res = await fetch('/api/users/me/telegram-link-code', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLinkCode(data.code);
        onActionToast("Telegram bog'lash kodi generatsiya qilindi.");
      } else {
        const err = await res.json();
        onActionToast(err.error || "Kod generatsiya qilishda xatolik yuz berdi.");
      }
    } catch (err) {
      console.error("Generate link code error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    }
  };

  useEffect(() => {
    if (topModal.isOpen) {
      // 98-band: pastdagi VIP narx effekti bilan bir xil so'rov, lekin bu yerda
      // .catch() va `data.price || 0` fallback yo'q edi — server 365 kundan
      // ortiq (yoki tarmoq xatosi) uchun {error:...} qaytarganda `data.price`
      // undefined bo'lib, "Hisoblangan narx: $undefined" ko'rsatilardi.
      fetch(`/api/top-boost/price?days=${boostDays}`)
        .then(res => res.json())
        .then(data => setEstimatedPrice(data.price || 0))
        .catch(() => {});
    }
  }, [boostDays, topModal.isOpen]);

  // MUHIM: bu yerda avval VIP narxi qattiq kodlangan `vipDays * 0.5 * 0.6`
  // formulasi bilan hisoblanardi — bu VIP_PRICE_PER_DAY/VIP_DISCOUNT_PERCENT
  // admin sozlamalaridan mustaqil edi (agar admin bu qiymatlarni o'zgartirsa,
  // foydalanuvchiga ko'rsatilgan narx bilan /api/vip/create orqali haqiqatda
  // undiriladigan narx mos kelmay qolardi). Endi TOP boost bilan bir xil
  // naqshda, haqiqiy narx serverdan (/api/vip/price) olinadi.
  useEffect(() => {
    fetch(`/api/vip/price?days=${vipDays}`)
      .then(res => res.json())
      .then(data => {
        setVipEstimatedPrice(data.price || 0);
        if (typeof data.discountPercent === 'number') setVipDiscountPercent(data.discountPercent);
      })
      .catch(() => {});
  }, [vipDays]);

  // Lock scroll on body when topModal is open, and clean up modal state on unmount
  useEffect(() => {
    if (topModal.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [topModal.isOpen]);

  useEffect(() => {
    return () => {
      // Clean up modal state when component unmounts
      setTopModal({ isOpen: false, startupId: null, startupName: '' });
    };
  }, []);

  const handleBuyTop = async () => {
    if (isBuyingTop) return;
    setIsBuyingTop(true);
    try {
      const res = await fetch('/api/top-boost/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startupId: topModal.startupId, days: boostDays })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
          return; // navigating away, keep button disabled
        } else {
          onActionToast("To'lov havolasini olishda xatolik yuz berdi.");
        }
      } else {
        const err = await res.json().catch(() => ({}));
        onActionToast(err.error || "TOP xizmatini sotib olishda xatolik yuz berdi.");
      }
    } catch (err) {
      console.error("TOP boost error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsBuyingTop(false);
    }
  };

  const handleBuyVip = async () => {
    if (isBuyingVip) return;
    setIsBuyingVip(true);
    try {
      const res = await fetch('/api/vip/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: vipDays })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
          return; // navigating away, keep button disabled
        } else {
          onActionToast("To'lov havolasini olishda xatolik yuz berdi.");
        }
      } else {
        const err = await res.json().catch(() => ({}));
        onActionToast(err.error || "VIP obunasini sotib olishda xatolik yuz berdi.");
      }
    } catch (err) {
      console.error("VIP subscription error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsBuyingVip(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const patchRes = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverUrl: data.url })
        });
        if (patchRes.ok) {
          setUser(prev => ({ ...prev, coverUrl: data.url }));
          onActionToast("Muqova rasmi muvaffaqiyatli yangilandi!");
        } else {
          const errData = await patchRes.json();
          onActionToast(errData.error || "Rasm manzilini saqlashda xatolik.");
        }
      } else {
        const errData = await res.json();
        onActionToast(errData.error || "Rasm yuklashda xatolik.");
      }
    } catch (err) {
      console.error("Cover upload error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsUploadingCover(false);
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
        // Automatically save to profile
        const patchRes = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarUrl: data.url })
        });
        if (patchRes.ok) {
          setEditAvatar(data.url);
          setUser(prev => ({ ...prev, avatarUrl: data.url }));
          onActionToast("Profil rasmi muvaffaqiyatli yangilandi!");
        } else {
          const errData = await patchRes.json();
          onActionToast(errData.error || "Rasm manzilini saqlashda xatolik.");
        }
      } else {
        const errData = await res.json();
        onActionToast(errData.error || "Rasm yuklashda xatolik.");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
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
  // Otherwise, there is nothing personal to show yet.
  const myStartups = user.id
    ? startups.filter((s: any) => s.userId === user.id)
    : [];

  const savedStartups = startups.filter((s) => bookmarkedIds.includes(s.id));

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingSettings) return;
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, avatarUrl: editAvatar }),
      });
      if (res.ok) {
        // MUHIM: server /api/users/me orqali `role`ni xavfsizlik sababli
        // (privilege escalation oldini olish uchun) qasddan qabul qilmaydi
        // va o'zgartirmaydi. Oldin bu yerda serverning haqiqiy javobidan
        // qat'i nazar mahalliy `editRole` qiymati state'ga yozib qo'yilardi —
        // foydalanuvchiga "saqlandi" deyilardi, aslida rol o'zgarmagan bo'lardi
        // (sahifa yangilanganda eski rol qaytib kelardi). Endi serverning
        // haqiqiy javobi ishlatiladi, rol tanlovi esa faqat ma'lumot uchun.
        const updatedUser = await res.json();
        setUser((prev) => ({
          ...prev,
          name: updatedUser.name,
          avatarUrl: updatedUser.avatarUrl,
        }));
        setEditRole(updatedUser.role);
        onActionToast('Profil sozlamalari muvaffaqiyatli saqlandi!');
      } else {
        const err = await res.json();
        onActionToast(err.error || "Sozlamalarni saqlashda xatolik yuz berdi.");
      }
    } catch (err) {
      console.error(err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCardClick = (id: string) => {
    setSelectedStartupId(id);
    setView('detail');
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {!user.emailVerified && user.id && (
        <div className="bg-secondary-container/10 border border-secondary-container/20 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-secondary mt-0.5">warning</span>
            <div>
              <h4 className="text-white font-bold text-sm">Hisobingiz tasdiqlanmagan</h4>
              <p className="text-on-primary-container text-xs mt-1">
                Hisobingizni tasdiqlash uchun <b>@Savdo24_Official_bot</b> botiga <b>/start {linkCode || user.telegramLinkCode || "kod_olish_uchun_bosing"}</b> deb yozing.
              </p>
            </div>
          </div>
          <button 
            onClick={generateLinkCode}
            className="shrink-0 bg-secondary text-on-secondary px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
          >
            Yangi kod olish
          </button>
        </div>
      )}

      {/* Profile Header Section */}
      <header className="relative mb-10 bg-primary-container border border-outline-variant/20 rounded-2xl overflow-hidden pb-6">
        <div className="h-48 w-full bg-gradient-to-br from-[#131b2e] to-[#0b1426] relative overflow-hidden flex items-center justify-center">
          {user.coverUrl ? (
            <img src={user.coverUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" loading="eager" fetchPriority="high" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1426] to-transparent"></div>
          )}
          {/* Subtle network connection pattern overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fdc338_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          <input 
            type="file" 
            ref={coverInputRef} 
            onChange={handleCoverUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <button
            onClick={() => coverInputRef.current?.click()}
            disabled={isUploadingCover}
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white border border-white/20 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isUploadingCover ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-sm">photo_camera</span>
            )}
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
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-success ${
            activeTab === 'referral'
              ? 'text-success border-success'
              : 'text-on-primary-container border-transparent hover:text-success'
          }`}
        >
          <span className="material-symbols-outlined text-lg">group_add</span>
          Referral
        </button>
        <button
          onClick={() => setActiveTab('b2b')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-secondary ${
            activeTab === 'b2b'
              ? 'text-secondary border-secondary'
              : 'text-on-primary-container border-transparent hover:text-secondary'
          }`}
        >
          <span className="material-symbols-outlined text-lg">business</span>
          B2B Wholesale
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-secondary-container ${
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
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-secondary ${
            activeTab === 'vip'
              ? 'text-secondary border-secondary'
              : 'text-on-primary-container border-transparent hover:text-secondary'
          }`}
        >
          <span className="material-symbols-outlined text-lg">workspace_premium</span>
          VIP a'zolik
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-8 py-4 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-secondary-container ${
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
        <ProfileB2BTab
          b2bAccount={b2bAccount}
          setB2BAccount={setB2BAccount}
          onActionToast={onActionToast}
          isSubmittingB2B={isSubmittingB2B}
          setIsSubmittingB2B={setIsSubmittingB2B}
        />
      )}

      {activeTab === 'referral' && (
        <ProfileReferralsTab
          user={user}
          referralStats={referralStats}
          onActionToast={onActionToast}
        />
      )}
      {activeTab === 'startups' && (
        <ProfileStartupsTab
          myStartups={myStartups}
          handleCardClick={handleCardClick}
          setView={setView}
          setTopModal={setTopModal}
        />
      )}

      {activeTab === 'vip' && (
        <ProfileVipTab
          vipDays={vipDays}
          setVipDays={setVipDays}
          vipDiscountPercent={vipDiscountPercent}
          vipEstimatedPrice={vipEstimatedPrice}
          handleBuyVip={handleBuyVip}
          isBuyingVip={isBuyingVip}
        />
      )}

      {/* TOP Boost Modal */}
      {topModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-md p-8 rounded-2xl border-secondary-container/30 space-y-6 shadow-2xl relative overflow-hidden">
            <button 
              onClick={() => setTopModal({ ...topModal, isOpen: false })}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-white focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
              aria-label="Yopish"
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
                <label className="text-xs uppercase font-bold text-on-primary-container mb-2 block">Kunlar soni</label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 7, 14, 30].map(d => (
                    <button 
                      key={d}
                      onClick={() => setBoostDays(d)}
                      className={`py-2 rounded-xl border font-bold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-secondary-container ${
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
                  onChange={(e) => setBoostDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold outline-none focus:outline-none focus:ring-2 focus:ring-secondary-container focus:ring-offset-2 focus:ring-offset-surface"
                  placeholder="Boshqa kun..."
                />
              </div>

              <div className="bg-secondary-container/5 p-4 rounded-2xl border border-secondary-container/20">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-on-primary-container">Hisoblangan narx:</span>
                  <span className="text-2xl font-black text-secondary-container">${estimatedPrice}</span>
                </div>
                <p className="text-xs text-on-primary-container mt-2 leading-tight">
                  * Narx joriy talab (aktiv TOP elonlar soni) asosida dinamik ravishda hisoblanadi.
                </p>
              </div>

              <button 
                onClick={handleBuyTop}
                disabled={isBuyingTop}
                className="w-full py-4 bg-secondary-container text-on-secondary-fixed font-black rounded-xl hover:brightness-110 transition-all shadow-lg shadow-secondary-container/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-secondary-container focus:ring-offset-2 focus:ring-offset-surface"
              >
                {isBuyingTop ? 'Yuklanmoqda...' : "🔝 To'lovga o'tish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'saved' && (
        <ProfileSavedTab
          savedStartups={savedStartups}
          categories={categories}
          handleCardClick={handleCardClick}
          setView={setView}
        />
      )}

      {activeTab === 'purchases' && (
        <ProfilePurchasesTab
          myPurchases={myPurchases}
          escrows={escrows}
          setEscrows={setEscrows}
          escrowActionId={escrowActionId}
          setEscrowActionId={setEscrowActionId}
          handleCardClick={handleCardClick}
          onActionToast={onActionToast}
        />
      )}

      {activeTab === 'earnings' && (
        <ProfileEarningsTab
          earningsData={earningsData}
        />
      )}

      {activeTab === 'reviews' && (
        <ProfileReviewsTab
          reviewsReceivedData={reviewsReceivedData}
          reviewsGiven={reviewsGiven}
        />
      )}

      {activeTab === 'settings' && (
        <ProfileSettingsTab
          handleSaveSettings={handleSaveSettings}
          fileInputRef={fileInputRef}
          isUploadingAvatar={isUploadingAvatar}
          editAvatar={editAvatar}
          setEditAvatar={setEditAvatar}
          handleAvatarUpload={handleAvatarUpload}
          user={user}
          editName={editName}
          setEditName={setEditName}
          editRole={editRole}
          isSavingSettings={isSavingSettings}
          linkCode={linkCode}
          generateLinkCode={generateLinkCode}
        />
      )}

      {activeTab === 'security' && (
        <ProfileSecurityTab
          sessions={sessions}
          revokeAllSessions={revokeAllSessions}
          revokeSession={revokeSession}
        />
      )}
    </div>
  );
}
