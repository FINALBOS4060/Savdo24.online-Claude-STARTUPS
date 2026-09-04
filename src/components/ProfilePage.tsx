import React, { useState, useEffect } from 'react';
import { Startup, UserProfileData, ProfileTab, Category } from '../types';
import { apiFetch as fetch } from '../lib/api';
import { formatDate } from '../lib/formatDate';
import { telegramLinkDeepLink, TELEGRAM_BOT_USERNAME } from '../lib/constants';
import { ProfileReferralsTab } from './profile/ProfileReferralsTab';
import { ProfileB2BTab } from './profile/ProfileB2BTab';
import { ProfileStartupsTab } from './profile/ProfileStartupsTab';
import { ProfileVipTab } from './profile/ProfileVipTab';
import { ProfileExchangeTab } from './profile/ProfileExchangeTab';
import { ProfileSavedTab } from './profile/ProfileSavedTab';
import { ProfilePurchasesTab } from './profile/ProfilePurchasesTab';
import { ProfileEarningsTab } from './profile/ProfileEarningsTab';
import { ProfileReviewsTab } from './profile/ProfileReviewsTab';
import { ProfileSettingsTab } from './profile/ProfileSettingsTab';
import { ProfileSecurityTab } from './profile/ProfileSecurityTab';
import { 
  AlertTriangle, 
  Camera, 
  CheckCircle, 
  Rocket, 
  Bookmark, 
  ShoppingCart, 
  Coins, 
  MessageSquare, 
  UserPlus, 
  Building2, 
  Settings, 
  Crown, 
  Shield, 
  X, 
  ArrowUpCircle,
  Repeat
} from 'lucide-react';

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
  const [linkCodeExpiresAt, setLinkCodeExpiresAt] = useState<number | null>(null);
  const [linkCodeSecondsLeft, setLinkCodeSecondsLeft] = useState<number>(0);
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

  // 1-so'rov: "Bildirishnomalarni boshqarish (opt-out)" — faqat reklama/
  // broadcast xabarlaridan chiqish uchun toggle.
  const handleToggleTelegramBroadcastOptOut = async (optOut: boolean) => {
    try {
      const res = await fetch('/api/users/me/telegram-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramBroadcastOptOut: optOut }),
      });
      if (res.ok) {
        setUser((prev) => ({ ...prev, telegramBroadcastOptOut: optOut }));
        onActionToast(optOut ? "Reklama xabarlari o'chirildi." : "Reklama xabarlari yoqildi.");
      } else {
        const err = await res.json();
        onActionToast(err.error || "Sozlamani saqlashda xatolik yuz berdi.");
      }
    } catch {
      onActionToast("Sozlamani saqlashda xatolik yuz berdi.");
    }
  };

  const generateLinkCode = async () => {
    try {
      const res = await fetch('/api/users/me/telegram-link-code', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLinkCode(data.code);
        // MUHIM: backend kod 15 daqiqa (15*60*1000 ms) amal qilishini
        // belgilaydi (server.ts), lekin frontend bu haqda hech qanday
        // vizual ko'rsatkichga ega emas edi — foydalanuvchi kod eskirganini
        // faqat botdan "kod muddati tugagan" xatosini olgandagina bilardi,
        // sahifada esa eski kod tinch qolib berardi. Endi shu muddatni
        // frontendda ham kuzatib, hisoblagich ko'rsatamiz.
        setLinkCodeExpiresAt(Date.now() + 15 * 60 * 1000);
        onActionToast("Telegram bog'lash kodi generatsiya qilindi. Kod 15 daqiqa amal qiladi.");
      } else {
        const err = await res.json();
        onActionToast(err.error || "Kod generatsiya qilishda xatolik yuz berdi.");
      }
    } catch (err) {
      console.error("Generate link code error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    }
  };

  // Har soniyada qolgan vaqtni yangilaydi va muddati tugaganda kodni
  // avtomatik tozalaydi — shunda UI "Yangi kod olish" tugmasiga o'zi
  // qaytadi, foydalanuvchi eskirgan kod bilan qolib ketmaydi.
  useEffect(() => {
    if (!linkCode || !linkCodeExpiresAt) {
      setLinkCodeSecondsLeft(0);
      return;
    }

    const tick = () => {
      const secondsLeft = Math.max(0, Math.round((linkCodeExpiresAt - Date.now()) / 1000));
      setLinkCodeSecondsLeft(secondsLeft);
      if (secondsLeft === 0) {
        setLinkCode(null);
        setLinkCodeExpiresAt(null);
        onActionToast("⏱ Kodning amal qilish muddati tugadi. Iltimos, yangi kod oling.");
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [linkCode, linkCodeExpiresAt, onActionToast]);

  // MUHIM: avval kod generatsiya qilingandan keyin foydalanuvchi botga o'tib
  // /start bosgach, sayt sahifasi bu haqda umuman xabardor bo'lmasdi —
  // "Hisobingiz tasdiqlanmagan" degan ogohlantirish banneri qo'lda sahifani
  // yangilamaguncha yo'qolmay turaverardi, garchi hisob allaqachon
  // tasdiqlangan bo'lsa ham. Endi kod faol bo'lganda sayt har 4 soniyada
  // holatni avtomatik tekshiradi va tasdiqlanishi bilanoq banner o'zi
  // yo'qoladi — foydalanuvchi qo'lda hech narsa qilishi shart emas.
  useEffect(() => {
    if (!linkCode || user.emailVerified) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        if (data.user?.emailVerified) {
          setUser((prev) => ({ ...prev, ...data.user }));
          setLinkCode(null);
          setLinkCodeExpiresAt(null);
          onActionToast("🎉 Hisobingiz Telegram orqali muvaffaqiyatli tasdiqlandi!");
        }
      } catch {
        // Tarmoq xatosi — jimgina keyingi urinishni kutamiz, foydalanuvchini
        // har 4 soniyada xato haqida bezovta qilish shart emas.
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [linkCode, user.emailVerified, setUser, onActionToast]);

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

  // SellPage.tsx'dagi rasm yuklash validatsiyasi bilan bir xil — backend
  // (multer, server.ts) 10MB va faqat jpeg/png/webp/gif'ni qabul qiladi.
  // Ilgari bu yerda hech qanday oldindan tekshiruv yo'q edi: foydalanuvchi
  // noto'g'ri formatdagi yoki juda katta faylni tanlasa, u avval to'liq
  // serverga yuklanib, KEYIN rad etilardi — vaqt va trafikni behuda
  // sarflardi. Endi xatolik darhol, hech narsa yuklanmasdan ko'rsatiladi.
  const validateImageFile = (file: File): string | null => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return "Fayl hajmi 10MB dan kam bo'lishi kerak.";
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return "Faqat JPG, PNG, WebP, yoki GIF formatini qo'llab-quvvatlaydi.";
    }
    return null;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      onActionToast(validationError);
      e.target.value = '';
      return;
    }

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

    const validationError = validateImageFile(file);
    if (validationError) {
      onActionToast(validationError);
      e.target.value = '';
      return;
    }

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

  // MUHIM BUG: bu effekt avval [user] (butun obyekt)ga bog'liq edi — ya'ni
  // `user` har safar o'zgarganda (masalan, foydalanuvchi "Sozlamalar"
  // bo'limida yangi ism yozib turgan payida, sahifa yuqorisidagi "Bannerni
  // tahrirlash" orqali muqova rasmini yuklasa — bu handleCoverUpload ichida
  // setUser(prev => ({...prev, coverUrl})) chaqiradi) editName/editRole/
  // editAvatar formadagi HALI SAQLANMAGAN o'zgarishlar serverdagi eski
  // qiymatlar bilan almashtirilib, jimgina yo'qolib qolardi. Endi faqat
  // foydalanuvchi identifikatori (birinchi yuklanish/login) o'zgarganda
  // ishga tushadi, forma har qanday tasodifiy `user` yangilanishida
  // qayta tiklanmaydi.
  React.useEffect(() => {
    setEditName(user.name);
    setEditRole(user.role);
    setEditAvatar(user.avatarUrl);
  }, [user.id]);

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
            <AlertTriangle className="text-secondary w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-on-primary-container font-bold text-sm">Hisobingiz tasdiqlanmagan</h4>
              {/* MUHIM: bu yerda avval noto'g'ri, ishlatilmaydigan bot nomi
                  ("@Savdo24_Official_bot") qattiq yozib qo'yilgan edi —
                  saytning haqiqiy boti @Savdo24_Register_bot bo'lsa ham.
                  Foydalanuvchi mavjud bo'lmagan botni qidirib, uni topa
                  olmasdi. Bundan tashqari kodni QO'LDA yozish talab
                  qilinardi — endi bitta tugma bosilsa bot ochilib, kod
                  avtomatik yuboriladi. */}
              <p className="text-on-primary-container text-xs mt-1">
                Hisobingizni tasdiqlash uchun Telegram botimizga ulaning — kod avtomatik yuboriladi, hech narsa yozish shart emas.
              </p>
              {linkCode && (
                <p className="text-on-primary-container/70 text-xs mt-1 font-mono">
                  ⏱ Kod amal qilish muddati: <span className="font-bold text-secondary">{String(Math.floor(linkCodeSecondsLeft / 60)).padStart(2, '0')}:{String(linkCodeSecondsLeft % 60).padStart(2, '0')}</span>
                </p>
              )}
            </div>
          </div>
          {linkCode ? (
            <a
              href={telegramLinkDeepLink(linkCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 bg-secondary text-on-secondary px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
            >
              🤖 @{TELEGRAM_BOT_USERNAME}'ni ochish
            </a>
          ) : (
            <button 
              onClick={generateLinkCode}
              className="shrink-0 bg-secondary text-on-secondary px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
            >
              Yangi kod olish
            </button>
          )}
        </div>
      )}

      {/* Profile Header Section */}
      <header className="relative mb-10 bg-primary-container border border-outline-variant/20 rounded-2xl overflow-hidden pb-6">
        <div className="h-48 w-full bg-gradient-to-br from-surface-container to-background relative overflow-hidden flex items-center justify-center">
          {user.coverUrl ? (
            <img src={user.coverUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" loading="eager" fetchPriority="high" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
          )}
          {/* Subtle network connection pattern overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(var(--color-secondary)_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
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
              <Camera className="w-4 h-4" />
            )}
            Bannerni tahrirlash
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-12 px-6 gap-6 relative z-10">
          <div className="relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-primary-container overflow-hidden shadow-2xl bg-background">
              <img
                className="w-full h-full object-cover"
                src={user.avatarUrl}
                alt={`${user.name} profil avatari`}
                loading="lazy"
                width={160}
                height={160}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.dataset.fallback) return;
                  img.dataset.fallback = '1';
                  img.src = '/default-avatar.svg';
                }}
              />
            </div>
            <div className="absolute bottom-2 right-2 w-8 h-8 bg-secondary-container rounded-full flex items-center justify-center border-4 border-background shadow-lg">
              <CheckCircle className="text-on-secondary-fixed w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 flex flex-col md:flex-row justify-between items-center md:items-end w-full text-center md:text-left">
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-on-primary-container flex items-center gap-2 justify-center md:justify-start">
                {user.name}
              </h1>
              <div className="flex items-center gap-2 mt-1 justify-center md:justify-start">
                <span className="px-3 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-bold text-xs uppercase tracking-wide">
                  {user.role}
                </span>
                <span className="text-on-primary-container text-xs">• A'zo bo'lgan sanasi: {formatDate(user.joinDate, { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('settings')}
                className="px-5 py-2 border border-outline-variant/40 rounded-xl font-bold text-xs hover:bg-white/5 text-on-primary-container transition-all active:scale-95"
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

      {/* Profile Tabs — ixchamlashtirish: avval 11 ta tab bitta gorizontal
          skroll qatorida, har biri katta (px-8 py-4) tugma bo'lib, mobil
          ekranda deyarli hammasi ko'rinmasdi (foydalanuvchi "Xavfsizlik"
          yoki "VIP" kabi tablarni topish uchun uzoq skroll qilishi kerak edi).
          Endi tablar mazmuniga ko'ra guruhlangan, kichik pill-tugmalarga
          o'tkazilgan (Admin panelidagi kabi), barchasi bir ekranga sig'adi va
          gorizontal skroll shart emas. */}
      {(() => {
        const PROFILE_TAB_GROUPS: { label: string; tabs: { id: ProfileTab; label: string; icon: any; count?: number; ring?: string }[] }[] = [
          {
            label: 'Asosiy',
            tabs: [
              { id: 'startups', label: 'Loyihalarim', icon: Rocket },
              { id: 'saved', label: 'Saqlanganlar', icon: Bookmark, count: savedStartups.length },
              { id: 'purchases', label: 'Xaridlarim', icon: ShoppingCart },
            ],
          },
          {
            label: 'Moliyaviy',
            tabs: [
              { id: 'earnings', label: 'Daromadlarim', icon: Coins },
              { id: 'referral', label: 'Referral', icon: UserPlus, ring: 'focus:ring-success' },
              { id: 'vip', label: "VIP a'zolik", icon: Crown, ring: 'focus:ring-secondary' },
              { id: 'b2b', label: 'B2B Wholesale', icon: Building2, ring: 'focus:ring-secondary' },
            ],
          },
          {
            label: 'Boshqa',
            tabs: [
              { id: 'reviews', label: 'Sharhlarim', icon: MessageSquare },
              { id: 'exchange', label: 'Obuna almashish', icon: Repeat, ring: 'focus:ring-secondary' },
              { id: 'settings', label: 'Sozlamalar', icon: Settings, ring: 'focus:ring-secondary-container' },
              { id: 'security', label: 'Xavfsizlik', icon: Shield, ring: 'focus:ring-secondary-container' },
            ],
          },
        ];
        return (
          <div className="space-y-2.5 mb-8 p-3 bg-primary-container/40 border border-outline-variant/20 rounded-2xl">
            {PROFILE_TAB_GROUPS.map(group => (
              <div key={group.label} className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-on-primary-container/40 w-full sm:w-auto sm:min-w-[80px] shrink-0">
                  {group.label}
                </span>
                {group.tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background ${tab.ring || 'focus:ring-secondary-container'} ${
                        isActive
                          ? 'bg-secondary-container text-on-secondary-fixed shadow-md'
                          : 'bg-surface-container text-on-primary-container hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {!!tab.count && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${isActive ? 'bg-on-secondary-fixed/20' : 'bg-secondary/20 text-secondary'}`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}

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

      {activeTab === 'exchange' && (
        <ProfileExchangeTab />
      )}

      {/* TOP Boost Modal */}
      {topModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-md p-8 rounded-2xl border-secondary-container/30 space-y-6 shadow-2xl relative overflow-hidden">
            <button 
              onClick={() => setTopModal({ ...topModal, isOpen: false })}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-on-primary-container focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <ArrowUpCircle className="w-10 h-10 text-secondary-container mx-auto" />
              <h3 className="text-2xl font-black text-on-primary-container">Elonni TOPga chiqarish</h3>
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
                          : 'bg-white/5 border-white/10 text-on-primary-container hover:bg-white/10'
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
                  className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-on-primary-container font-mono font-bold outline-none focus:outline-none focus:ring-2 focus:ring-secondary-container focus:ring-offset-2 focus:ring-offset-surface"
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
          linkCodeSecondsLeft={linkCodeSecondsLeft}
          generateLinkCode={generateLinkCode}
          onToggleTelegramBroadcastOptOut={handleToggleTelegramBroadcastOptOut}
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
