import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Lock, 
  RefreshCw, 
  ExternalLink, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  Send, 
  Hourglass, 
  Download, 
  Code, 
  Mail, 
  Phone, 
  ShieldCheck 
} from 'lucide-react';
import { UserProfileData, Startup } from '../types';
import { apiFetch as fetch } from '../lib/api';
import { trackEvent } from '../lib/analytics';

interface CheckoutPageProps {
  amount: number;
  user: UserProfileData;
  setUser: React.Dispatch<React.SetStateAction<UserProfileData>>;
  onActionToast: (message: string) => void;
  setView: (view: string) => void;
  onSuccessPayment: () => void;
  startup?: Startup;
}

export default function CheckoutPage({
  amount,
  user,
  setUser,
  onActionToast,
  setView,
  onSuccessPayment,
  startup,
}: CheckoutPageProps) {
  const startupId = startup?.id;
  const [timeLeft, setTimeLeft] = useState(899); // 14:59 in seconds
  const [paymentStep, setPaymentStep] = useState<'checkout' | 'processing' | 'success'>('checkout');
  const [activeOrderId, setActiveOrderId] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [gateway, setGateway] = useState<string>('coingate');
  const [apiKeysMissing, setApiKeysMissing] = useState<boolean>(false);
  const [referralCode, setReferralCode] = useState<string>(localStorage.getItem('savdo24_referral_code') || '');
  const [discountData, setDiscountData] = useState<{ discountPercent: number; referrerName?: string; type?: 'b2b' | 'referral' } | null>(null);
  const [isApplyingReferral, setIsApplyingReferral] = useState<boolean>(false);

  type DeliveryData = { 
    deliveryUrl?: string; 
    sellerContact?: string; 
    repoUrl?: string; 
    telegramToken?: string;
  };
  const [deliveryData, setDeliveryData] = useState<DeliveryData>({});

  // Automatic CoinGate Order Creation on Mount with duplicate protection.
  // MUHIM: bu effekt ichida `activeOrderId` state'i o'rnatilardi VA aynan
  // shu state effektning dependency arrayida ham bor edi — natijada
  // setActiveOrderId chaqirilgach effekt qayta ishga tushib, o'zining
  // cleanup funksiyasi orqali hozirgina o'rnatilgan redirectTimer'ni
  // (1.5 soniyadan keyin CoinGate to'lov sahifasiga avtomatik
  // yo'naltirish uchun) darhol bekor qilib qo'yardi — shu sabab avtomatik
  // yo'naltirish HECH QACHON ishlamas edi (faqat qo'lda "To'lovni
  // yakunlash" tugmasi ishlardi). Endi takroriy chaqiruvni oldini olish
  // uchun state o'rniga ref ishlatiladi, shunda effekt qayta ishga
  // tushmaydi va o'z taymerini bekor qilmaydi.
  const paymentInitiatedRef = React.useRef(false);
  // MUHIM: redirectTimer avval useEffect ichidagi mahalliy o'zgaruvchi edi —
  // referralCode input maydoni xuddi shu sahifada bo'lsa-da, uni bekor
  // qilishning iloji yo'q edi. Endi ref orqali saqlanadi, shunda referral
  // kod qo'llanganda avtomatik yo'naltirishni bekor qilish mumkin.
  const redirectTimerRef = React.useRef<any>(null);
  useEffect(() => {
    let isMounted = true;

    const initPayment = async () => {
      try {
        if (paymentInitiatedRef.current) return;

        if (!startupId) {
          if (isMounted) {
            onActionToast("Xarid qilish uchun mahsulot tanlanmagan.");
            setView("browse");
          }
          return;
        }

        paymentInitiatedRef.current = true;

        const res = await fetch('/api/payments/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount,
            startupId
          }),
        });

        if (!isMounted) return;

        if (res.ok) {
          trackEvent('checkout_start', startupId, 'checkout_page', { amount });
          const data = await res.json();
          setActiveOrderId(data.id);
          if (data.gateway) setGateway(data.gateway);
          if (data.discountPercent && data.discountPercent > 0) {
            setDiscountData({
              discountPercent: data.discountPercent,
              type: data.discountType as 'b2b' | 'referral',
              referrerName: data.discountType === 'b2b' ? 'B2B' : ''
            });
            if (data.discountType === 'b2b') {
              onActionToast(`${data.discountPercent}% B2B ulgurji chegirmasi qo'llanildi`);
            }
          }
          if (data.paymentUrl) {
            setPaymentUrl(data.paymentUrl);
            // XATO: agar foydalanuvchida referral kod bo'lsa (masalan,
            // referral havola orqali kirgan), 1.5 soniyada CoinGate'ga
            // yo'naltirilib, kodni qo'llash imkoniyati yo'qolib qolardi —
            // shuning uchun referral kod mavjud bo'lsa avtomatik
            // yo'naltirish o'chiriladi, foydalanuvchi qo'lda tugmani bosadi.
            if (!referralCode) {
              redirectTimerRef.current = setTimeout(() => {
                if (isMounted) {
                  window.location.href = data.paymentUrl;
                }
              }, 1500);
            }
          }
          if (data.api_keys_missing) setApiKeysMissing(true);
        } else {
          // 42-MUAMMO: server aniq sabab (allaqachon sotilgan, email
          // tasdiqlanmagan, referral xato va h.k.) qaytarsa ham, bu yerda
          // doim umumiy "yaratib bo'lmadi" xabari ko'rsatilib, foydalanuvchi
          // sababsiz "Yaratilmoqda..." holatida qolgan checkout sahifasida
          // qotib qolardi — endi server xabari ko'rsatiladi va browse'ga qaytariladi.
          if (isMounted) {
            let serverError = "To'lov buyurtmasini yaratib bo'lmadi.";
            try {
              const errData = await res.json();
              if (errData?.error) serverError = errData.error;
            } catch {}
            onActionToast(serverError);
            setView("browse");
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Init payment error:", err);
          onActionToast("To'lov tizimi bilan ulanishda xatolik.");
        }
      }
    };

    initPayment();

    return () => {
      isMounted = false;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [startupId, amount]);

  const applyReferralCode = async () => {
    if (!referralCode || referralCode.trim().length === 0) {
      onActionToast("Iltimos, referral kodini kiriting.");
      return;
    }
    
    if (isApplyingReferral) return;

    // Referral qo'llanayotganda avtomatik CoinGate'ga yo'naltirish bekor qilinadi
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }

    // Client-side validation
    if (referralCode.length > 10 || !/^[A-Z0-9]+$/.test(referralCode.trim().toUpperCase())) {
      onActionToast("Referral kod noto'g'ri formatda.");
      return;
    }

    setIsApplyingReferral(true);
    try {
      const res = await fetch(`/api/referrals/apply?code=${referralCode.trim().toUpperCase()}`);

      if (res.ok) {
        const data = await res.json();
        
        // Re-init payment with referral code
        const payRes = await fetch('/api/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, startupId, referralCode: referralCode.trim().toUpperCase() })
        });
        if (payRes.ok) {
          const payData = await payRes.json();
          setActiveOrderId(payData.id);
          if (payData.gateway) setGateway(payData.gateway);
          if (payData.paymentUrl) setPaymentUrl(payData.paymentUrl);

          if (payData.discountPercent && payData.discountPercent > 0) {
            setDiscountData({
              discountPercent: payData.discountPercent,
              type: payData.discountType as 'b2b' | 'referral',
              referrerName: payData.discountType === 'referral' ? data.referrerName : 'B2B'
            });

            if (payData.discountType === 'b2b') {
              onActionToast(`${payData.discountPercent}% B2B ulgurji chegirmasi qo'llanildi`);
            } else {
              onActionToast(`Chegirma qo'llanildi: ${payData.discountPercent}% (${data.referrerName} tomonidan)`);
            }
          }
        }
      } else if (res.status === 429) {
        onActionToast("Juda ko'p harakat. 5 daqiqa kuting.");
      } else {
        const data = await res.json();
        onActionToast(data.error || "Referral kod xato yoki tugagan.");
      }
    } catch (err) {
      console.error("Referral error:", err);
      onActionToast("Referral kodini qo'llashda xatolik.");
    } finally {
      setIsApplyingReferral(false);
    }
  };

  // Real-time payment status polling (3 seconds) with leak/duplicate protection
  useEffect(() => {
    if (!activeOrderId || paymentStep !== 'checkout') return;

    let isPolling = true;
    let pollInterval: any = null;

    const pollPaymentStatus = async () => {
      if (!isPolling) return;

      try {
        const res = await fetch(`/api/payments/status/${activeOrderId}`);
        if (!isPolling) return; // Check again after fetch

        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed' && isPolling) {
            setDeliveryData({ 
              deliveryUrl: data.deliveryUrl, 
              sellerContact: data.sellerContact, 
              repoUrl: data.repoUrl,
              telegramToken: data.telegramToken
            });
            setPaymentStep('success');
            onSuccessPayment();
            onActionToast("Muvaffaqiyatli! To'lov tizim tomonidan qabul qilindi.");
            isPolling = false; // Stop polling
          } else if (!data.status) {
            console.warn("Invalid payment status response:", data);
          }
        } else if (res.status === 404) {
          console.warn("Order not found:", activeOrderId);
          isPolling = false; // Stop if order doesn't exist
        }
      } catch (err) {
        console.error("Polling payment status error:", err);
        // Don't stop on error - retry next interval
      } finally {
        if (isPolling) {
          pollInterval = setTimeout(pollPaymentStatus, 3000);
        }
      }
    };

    // Start polling immediately
    pollPaymentStatus();

    return () => {
      isPolling = false;
      if (pollInterval) clearTimeout(pollInterval);
    };
  }, [activeOrderId, paymentStep, onSuccessPayment, onActionToast]);

  // Countdown timer
  useEffect(() => {
    if (paymentStep !== 'checkout') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [paymentStep]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  // XATO: `isExpired` bu yerda faqat frontend'dagi 15 daqiqalik ko'rsatkich
  // taymeriga asoslangan edi, lekin haqiqiy to'lov buyurtmasi backend'da
  // (src/lib/payments.ts) 24 SOATGACHA amal qiladi. Natijada 15 daqiqadan
  // keyin: (1) "To'lov sahifasiga o'tish" tugmasi noto'g'ri "Vaqt tugadi"
  // xabari bilan bloklanardi — garchi to'lov havolasi haligacha amal
  // qilsa ham, va (2) "To'lov holatini tekshirish" tugmasi ham bloklanardi
  // (garchi fondagi avtomatik 3 soniyalik polling buni bilmasdan davom
  // etaversa ham). Ya'ni foydalanuvchi to'lovni kechroq (masalan 20-30
  // daqiqada, kripto pul o'tkazmasi tez-tez shuncha vaqt oladi) yakunlasa
  // ham, sahifaga qaytib "qayta tekshirish"ni bosolmasdi — faqat fondagi
  // polling uni tasodifan ushlab olishiga umid qilishga majbur bo'lardi.
  // Backend haqiqiy amal qilish muddatini bilgani uchun, endi bu yerda
  // faqat KO'RSATKICH sifatida qoladi (qizil rang/"Vaqt tugadi" matni),
  // lekin amallarni bloklamaydi — server o'zi (agar rostdan muddati
  // o'tgan bo'lsa) mos xato/holat qaytaradi.
  const isExpired = timeLeft <= 0 && paymentStep === 'checkout';

  const handleCoinGateRedirect = () => {
    if (paymentUrl) {
      window.location.href = paymentUrl;
      onActionToast(gateway === 'stripe' ? "Xavfsiz to'lov sahifasiga yo'naltirilmoqda..." : "CoinGate xavfsiz to'lov sahifasiga yo'naltirilmoqda...");
    } else {
      onActionToast("To'lov manzili hali yaratilmoqda, iltimos kuting...");
    }
  };

  const handleVerifyPayment = async () => {
    if (!activeOrderId) {
      onActionToast("To'lov buyurtmasi hali tayyor emas.");
      return;
    }
    setIsChecking(true);
    try {
      const res = await fetch(`/api/payments/status/${activeOrderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'completed') {
          setDeliveryData({ 
            deliveryUrl: data.deliveryUrl, 
            sellerContact: data.sellerContact, 
            repoUrl: data.repoUrl,
            telegramToken: data.telegramToken
          });
          setPaymentStep('success');
          onSuccessPayment();
          onActionToast("Muvaffaqiyatli! To'lov qabul qilindi.");
        } else {
          onActionToast("To'lov kutilmoqda. To'lov shlyuzida amalni yakunlang!");
        }
      } else {
        onActionToast("To'lov holatini tekshirib bo'lmadi.");
      }
    } catch (err) {
      console.error(err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in text-left">
      {paymentStep === 'checkout' && (
        <div className={`bg-background border ${gateway === 'stripe' ? 'border-indigo-600/30' : 'border-success/30'} rounded-2xl overflow-hidden shadow-2xl`}>
          {/* Header */}
          <div className={gateway === 'stripe' ? "bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-5 flex items-center justify-between text-white" : "bg-gradient-to-r from-success to-emerald-700 px-8 py-5 flex items-center justify-between text-white"}>
            <div className="flex items-center gap-3">
              {gateway === 'stripe' ? <CreditCard className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
              <span className="font-extrabold text-xl tracking-tight">
                {gateway === 'stripe' ? "Karta orqali xavfsiz to'lov" : "CoinGate Secure Checkout"}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs font-extrabold uppercase tracking-widest opacity-70">Sotuvchi</p>
              <p className="text-xs font-bold uppercase">Savdo24</p>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Redirect Banner */}
            <div className={gateway === 'stripe' ? "bg-indigo-600/10 border border-indigo-600/20 rounded-2xl p-6 text-center space-y-4" : "bg-success/10 border border-success/20 rounded-2xl p-6 text-center space-y-4"}>
              <div className={gateway === 'stripe' ? "flex items-center justify-center gap-2 text-indigo-400" : "flex items-center justify-center gap-2 text-success"}>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="font-bold text-sm">
                  {gateway === 'stripe' ? "Stripe to'lov tizimiga yo'naltirilmoqda..." : "CoinGate to'lov tizimiga yo'naltirilmoqda..."}
                </span>
              </div>
              <p className="text-xs text-on-primary-container leading-relaxed">
                {gateway === 'stripe'
                  ? "Kredit/debet karta orqali to'lovni amalga oshirish uchun xavfsiz sahifaga yo'naltirilasiz. Agar avtomatik tarzda o'tmasa, quyidagi tugmani bosing."
                  : "Xavfsiz USDT (TRC20, ERC20 va boshqalar) to'lovini amalga oshirishingiz uchun CoinGate sahifasiga yo'naltirilasiz. Agar avtomatik tarzda o'tmasa, quyidagi yashil tugmani bosing."
                }
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={handleCoinGateRedirect}
                  className={gateway === 'stripe' ? "px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10" : "px-6 py-3 bg-success hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-success/10"}
                >
                  <ExternalLink className="w-4 h-4 font-bold" />
                  To'lov sahifasiga o'tish
                </button>
                {startupId && (
                  <a
                    href={`https://t.me/Savdo24_Register_bot?start=buy_${startupId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-[#229ED9] hover:bg-[#1c8bc0] active:scale-95 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#229ED9]/10"
                  >
                    <Send className="w-4 h-4 font-bold" />
                    Telegram orqali to'lash
                  </a>
                )}
              </div>
            </div>

            {/* Order Details Grid */}
            <div className="grid grid-cols-2 gap-6 bg-white/5 p-5 rounded-2xl border border-white/5">
              <div>
                <p className="text-xs text-on-primary-container font-extrabold uppercase tracking-wider mb-1">Loyha nomi</p>
                <p className="text-sm font-bold text-on-background truncate">{startup?.name || "Loyiha xaridi"}</p>
              </div>
              <div>
                <p className="text-xs text-on-primary-container font-extrabold uppercase tracking-wider mb-1">Buyurtma ID</p>
                <p className="text-sm font-bold text-on-background font-mono">{activeOrderId || "Yaratilmoqda..."}</p>
              </div>
              <div className="col-span-2 pt-4 border-t border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-xs text-on-primary-container font-extrabold uppercase tracking-wider mb-1">To'lanadigan summa</p>
                  <p className={gateway === 'stripe' ? "text-2xl font-black text-indigo-400 font-mono" : "text-2xl font-black text-success font-mono"}>
                    ${(discountData ? amount * (1 - discountData.discountPercent / 100) : amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {gateway === 'stripe' ? 'USD' : 'USDT'}
                  </p>
                  {discountData && (
                    <p className="text-xs text-emerald-400 font-bold">
                      {discountData.type === 'b2b'
                        ? `-${discountData.discountPercent}% B2B ulgurji chegirmasi qo'llanildi`
                        : `-${discountData.discountPercent}% referral chegirmasi qo'llanildi`}
                    </p>
                  )}
                </div>
                <div className={`text-right rounded-xl px-3 py-1.5 font-mono text-xs font-bold flex items-center gap-1.5 border ${isExpired ? 'bg-red-500/10 text-red-400 border-red-500/20' : (gateway === 'stripe' ? 'bg-indigo-600/10 text-indigo-400 border-indigo-600/20' : 'bg-success/10 text-success border-success/20')}`}>
                  <Clock className="w-4 h-4" />
                  {isExpired ? "Vaqt tugadi" : formatTime(timeLeft)}
                </div>
              </div>

              <div className="col-span-2 space-y-2">
                <label className="text-xs text-on-primary-container font-extrabold uppercase tracking-wider block">Referral kod (Chegirma uchun)</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className={`flex-1 bg-surface-container-low border border-white/10 rounded-xl px-4 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface ${gateway === 'stripe' ? 'focus:border-indigo-600' : 'focus:border-success'}`}
                    placeholder="KODNI KIRITING"
                  />
                  <button 
                    onClick={applyReferralCode}
                    disabled={isApplyingReferral}
                    className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
                  >
                    {isApplyingReferral ? "Kutilyapti..." : "Qo'llash"}
                  </button>
                </div>
              </div>
            </div>

            {/* API Keys Configuration Banner */}
            {apiKeysMissing && (
              <div className="bg-secondary/10 border border-secondary/30 rounded-2xl p-4 text-xs text-secondary leading-relaxed space-y-1">
                <p className="font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-secondary" />
                  Eslatma: CoinGate API kaliti sozlanmagan
                </p>
                <p>
                  Real CoinGate to'lovlarini sinash uchun .env faylida <strong>COINGATE_API_TOKEN</strong> ni sozlash talab etiladi. Hozirda interaktiv to'lov simulyatori faol.
                </p>
              </div>
            )}

            {/* Verification Controls */}
            <div className="border-t border-white/5 pt-6 flex flex-col items-center gap-3">
              <p className="text-xs text-on-primary-container text-center">
                To'lovni muvaffaqiyatli yakunlagach, tizim uni avtomat ravishda tasdiqlaydi. Yoki qo'lda tekshirishingiz mumkin:
              </p>
              {activeOrderId && (
                <button
                  onClick={handleVerifyPayment}
                  disabled={isChecking}
                  className={gateway === 'stripe'
                    ? "px-6 py-3 border border-indigo-600/30 hover:bg-indigo-600/5 active:scale-95 text-indigo-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    : "px-6 py-3 border border-success/30 hover:bg-success/5 active:scale-95 text-success font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"}
                >
                  {isChecking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {isChecking ? "Tekshirilmoqda..." : "To'lov holatini tekshirish"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Processing Step */}
      {paymentStep === 'processing' && (
        <div className="bg-background border border-outline-variant/30 rounded-2xl p-12 text-center space-y-8 shadow-2xl min-h-[400px] flex flex-col justify-center items-center">
          <div className="relative w-24 h-24">
            <div className={`absolute inset-0 border-4 ${gateway === 'stripe' ? 'border-indigo-600/20' : 'border-success/20'} rounded-full`}></div>
            <div className={`absolute inset-0 border-4 ${gateway === 'stripe' ? 'border-indigo-600' : 'border-success'} border-t-transparent rounded-full animate-spin`}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              {gateway === 'stripe' ? <CreditCard className={`w-8 h-8 ${gateway === 'stripe' ? 'text-indigo-400' : 'text-success'} animate-pulse`} /> : <Lock className={`w-8 h-8 ${gateway === 'stripe' ? 'text-indigo-400' : 'text-success'} animate-pulse`} />}
            </div>
          </div>
          <div className="space-y-2 max-w-sm">
            <h2 className="text-xl font-black text-on-background">Tranzaksiya tasdiqlanmoqda</h2>
            <p className="text-xs text-on-primary-container leading-relaxed">
              {gateway === 'stripe'
                ? "Karta tranzaksiyasi tasdiqlanmoqda. Iltimos, ushbu oynani yopmang yoki yangilamang."
                : "CoinGate USDT tranzaksiyasi tasdiqlanmoqda. Iltimos, ushbu oynani yopmang yoki yangilamang."}
            </p>
          </div>
        </div>
      )}

      {/* Payment Success Receipt */}
      {paymentStep === 'success' && (
        <div className="bg-background border border-green-500/30 rounded-2xl p-8 shadow-2xl space-y-8 animate-scale-up">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/10 text-green-400 border border-green-500/30 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-8 h-8 font-bold" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-on-background">Xarid tasdiqlandi!</h2>
              <p className="text-xs text-on-primary-container mt-1">{activeOrderId} ID raqamli buyurtma xarid kvitansiyasi</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-4 font-semibold text-sm">
            <div className="flex justify-between">
              <span className="text-on-primary-container">Jami summa</span>
              <span className="text-on-background font-mono font-bold">${(discountData ? amount * (1 - discountData.discountPercent / 100) : amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {gateway === 'stripe' ? 'USD' : 'USDT'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-primary-container">Mahsulot</span>
              <span className="text-secondary-container font-bold">{startup?.name || "Sotib olingan loyiha"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-primary-container">To'lov holati</span>
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
                Tasdiqlangan ({gateway === 'stripe' ? 'Stripe' : 'CoinGate'})
              </span>
            </div>

            <div className="pt-4 border-t border-white/5 flex flex-col gap-1.5 mt-4">
              <span className="text-xs text-on-primary-container uppercase mb-1 flex items-center gap-1"><Truck className="w-4 h-4" /> Yetkazib berish ma'lumoti</span>
              {deliveryData.deliveryUrl ? (
                <div className="space-y-3">
                  <a 
                    href={deliveryData.deliveryUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    onClick={(e) => {
                      // Validate URL before redirect
                      try {
                        const url = new URL(deliveryData.deliveryUrl!);
                        if (!url.protocol.startsWith('http')) {
                          e.preventDefault();
                          onActionToast("Xavfsiz bo'lmagan havola.");
                        }
                      } catch {
                        e.preventDefault();
                        onActionToast("Havola xato.");
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-success/10 border border-success/30 text-success rounded-xl font-bold hover:bg-success/20 transition-all text-sm"
                  >
                    Loyihani yuklab olish (Sotuvchi havolasi)
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {deliveryData.telegramToken && (
                    <a 
                      href={`https://t.me/Savdo24Bot?start=${encodeURIComponent(deliveryData.telegramToken)}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="w-full flex items-center justify-center gap-2 py-3 bg-sky-400/10 border border-sky-400/30 text-sky-400 rounded-xl font-bold hover:bg-sky-400/20 transition-all text-sm"
                    >
                      📥 Telegram bot orqali yuklab olish
                      <Send className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ) : (
                // Hide seller contact - use encrypted/masked display
                <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex flex-col items-center text-center">
                  <Hourglass className="text-success w-6 h-6 mb-2 text-2xl" />
                  <p className="text-on-background text-sm font-bold mb-1">Sotuvchi 24 soat ichida siz bilan bog'lanadi</p>
                  <p className="text-success text-xs">
                    Aloqa ma'lumotlari maxfiy: {deliveryData.sellerContact ? '✓ Qabul qilindi' : '⏳ Kutilmoqda'}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 flex flex-col gap-1.5">
              <span className="text-xs text-on-primary-container uppercase">Buyurtma ID raqami</span>
              <span className="text-white font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap bg-black/40 p-2.5 rounded-lg border border-white/5 select-all" title={activeOrderId}>
                {activeOrderId}
              </span>
            </div>
          </div>

          {/* Manba kodiga kirish / Loyihani olish */}
          <div className="bg-secondary-container/10 border border-success/20 rounded-2xl p-5 space-y-4 text-left">
            <h4 className="text-success font-bold text-sm flex items-center gap-2">
              <Download className="w-4 h-4" />
              Loyihani qabul qilib olish
            </h4>
            
            <div className="space-y-3">
              <p className="text-xs text-on-primary-container leading-relaxed">
                Tabriklaymiz! Loyihani muvaffaqiyatli xarid qildingiz. Quyidagi havola orqali loyihaning manba kodini yoki materiallarini olishingiz mumkin:
              </p>
              <div className="flex flex-col gap-2.5 pt-1">
                {deliveryData.deliveryUrl || startup?.deliveryUrl ? (
                  <a
                    href={deliveryData.deliveryUrl || startup?.deliveryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-white/10"
                  >
                    <Code className="w-4 h-4" />
                    Loyiha omboriga / Havolasiga o'tish
                  </a>
                ) : (
                  <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center text-xs text-on-background">
                    Sotuvchi ushbu loyiha uchun yetkazib berish havolasini kiritmagan. Iltimos, pastdagi aloqa ma'lumotlari orqali sotuvchi bilan bog'laning.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
              <p className="text-xs text-on-primary-container">
                Muammo yuzaga kelsa yoki qo'shimcha savollar bo'lsa, to'g'ridan-to'g'ri sotuvchi bilan bog'lanishingiz mumkin:
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-on-background">
                {startup?.contactTelegram && (
                  <a
                    href={`https://t.me/${startup.contactTelegram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-400/10 text-sky-400 hover:bg-sky-400/20 rounded-xl transition-all font-bold"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Telegram: {startup.contactTelegram}
                  </a>
                )}
                {startup?.contactEmail && (
                  <a
                    href={`mailto:${startup.contactEmail}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-on-background/80 hover:bg-white/10 rounded-xl transition-all font-bold font-mono"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {startup.contactEmail}
                  </a>
                )}
                {startup?.contactPhone && (
                  <a
                    href={`tel:${startup.contactPhone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-on-background/80 hover:bg-white/10 rounded-xl transition-all font-bold font-mono"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {startup.contactPhone}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setView('profile')}
              className="flex-1 py-4 border border-outline-variant/40 hover:bg-white/5 text-on-background font-bold text-sm rounded-xl transition-all"
            >
              Boshqaruv paneliga o'tish
            </button>
            <button
              onClick={() => setView('browse')}
              className="flex-1 py-4 bg-secondary-container text-on-secondary-fixed font-bold text-sm rounded-xl hover:brightness-110 transition-all"
            >
              Loyihalarni ko'rish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
