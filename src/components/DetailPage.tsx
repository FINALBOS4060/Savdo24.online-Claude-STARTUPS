import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { MessageSquare, Star } from 'lucide-react';
import { Startup, Idea, UserProfileData, Category } from '../types';
import { apiFetch as fetch } from '../lib/api';
import { formatDate } from '../lib/formatDate';

import { DetailHeroSection } from './detail/DetailHeroSection';
import { DetailTechnicalSpecs } from './detail/DetailTechnicalSpecs';
import { DetailIdeasSection } from './detail/DetailIdeasSection';
import { DetailSidebar } from './detail/DetailSidebar';
import { DetailModals } from './detail/DetailModals';

interface DetailPageProps {
  startups: Startup[];
  setView: (view: string) => void;
  bookmarkedIds: string[];
  toggleBookmark: (id: string) => void;
  onActionToast: (message: string) => void;
  setCheckoutAmount: (amount: number) => void;
  user?: UserProfileData;
  categories: Category[];
  setSelectedStartupId?: (id: string) => void;
}

export default function DetailPage({
  startups,
  setView,
  bookmarkedIds,
  toggleBookmark,
  onActionToast,
  setCheckoutAmount,
  user,
  categories,
  setSelectedStartupId,
}: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  
  // Find the current startup by ID from URL
  // MUHIM: bu yerda ataylab early-return QILINMAYDI — pastda hali ko'plab
  // useState/useEffect chaqiruvlari bor, React Hooks qoidasiga ko'ra ular
  // har renderda bir xil tartibda va sonda chaqirilishi SHART. `startup`
  // topilmagan holatdagi JSX pastda, barcha hooklardan KEYIN qaytariladi.
  const startup = startups.find(s => s.id === id);

  const isBookmarked = startup ? bookmarkedIds.includes(startup.id) : false;

  // Update SEO Meta Tags
  useEffect(() => {
    if (!startup) return;

    // Set title
    document.title = `${startup.name} — Savdo24`;

    // Helper to set meta tag
    const setMetaTag = (property: string, content: string, isName = false) => {
      const selector = isName ? `meta[name="${property}"]` : `meta[property="${property}"]`;
      let element = document.querySelector(selector);
      
      if (!element) {
        element = document.createElement('meta');
        if (isName) {
          element.setAttribute('name', property);
        } else {
          element.setAttribute('property', property);
        }
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Set Open Graph tags
    setMetaTag('og:title', `${startup.name} - ${startup.slogan || 'Startap'}`);
    setMetaTag('og:description', startup.description || '');
    setMetaTag('og:image', startup.image || '');
    setMetaTag('og:type', 'website');
    
    // Set standard meta tags
    setMetaTag('description', startup.slogan || startup.description || `${startup.name} sotiladi.`, true);

    // Cleanup when leaving
    return () => {
      document.title = "Savdo24 — Startaplar va raqamli loyihalar bozori";
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', "O'zbekistondagi eng yirik startaplar, loyihalar va raqamli bizneslar savdo maydonchasi.");
      }
    };
  }, [startup]);

  // Parse dynamic category-specific attributes
  let parsedAttrs: Record<string, string> = {};
  if (startup?.attributes) {
    try {
      parsedAttrs = JSON.parse(startup.attributes);
    } catch (e) {
      console.error("Error parsing attributes:", e);
    }
  }

  // Map of internal keys to Uzbek labels
  const attributeLabels: Record<string, string> = {
    revenue: "Oylik daromad",
    activeUsers: "Faol foydalanuvchilar",
    foundersCount: "Ta'sischilar soni",
    targetLlm: "Mo'ljallangan LLM",
    domain: "Qo'llanish sohasi",
    framework: "Texnik stack",
    integrationType: "Integratsiya turi",
    parameters: "Parametrlar soni",
    platform: "Platforma",
    monthlyTraffic: "Oylik tashrif",
    techRequirement: "Texnik talablar",
    fileFormat: "Fayl formati",
    licenseType: "Litsenziya turi"
  };

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState<boolean>(true);
  const [newIdeaContent, setNewIdeaContent] = useState('');
  const [newIdeaAuthor, setNewIdeaAuthor] = useState('');
  const [isSubmittingIdea, setIsSubmittingIdea] = useState(false);
  // IdeasRatingPage.tsx'dagi 118-band bilan bir xil muammo turi: "Ovoz
  // berish" tugmasi so'rov davomida disabled bo'lmasdi.
  const [votingIdeaIds, setVotingIdeaIds] = useState<Set<number>>(new Set());

  // Reviews and disputes state
  const [hasPurchased, setHasPurchased] = useState<boolean>(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [sellerReviewsData, setSellerReviewsData] = useState<any>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);

  // Review form fields
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Dispute form fields
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  // Report form fields
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTargetType, setReportTargetType] = useState<'startup' | 'idea' | 'user'>('startup');
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportReason, setReportReason] = useState('Firibgar elon');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const handleOpenReportModal = (type: 'startup' | 'idea' | 'user', id: string) => {
    if (!user || user.name === 'Mehmon') {
      onActionToast("Iltimos, shikoyat yuborish uchun avval tizimga kiring.");
      return;
    }
    setReportTargetType(type);
    setReportTargetId(id);
    setReportReason('Firibgar elon');
    setReportDescription('');
    setReportModalOpen(true);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReport(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetType: reportTargetType,
          targetId: reportTargetId,
          reason: reportReason,
          description: reportDescription,
        }),
      });

      if (res.ok) {
        onActionToast("Shikoyatingiz muvaffaqiyatli qabul qilindi. Tez orada ko'rib chiqiladi.");
        setReportModalOpen(false);
      } else {
        const data = await res.json();
        onActionToast(data.error || 'Shikoyat yuborishda xatolik yuz berdi.');
      }
    } catch (err) {
      console.error(err);
      onActionToast('Serverga ulanishda xatolik.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const checkPurchase = async () => {
    if (!startup) return;
    try {
      const res = await fetch('/api/payments/my');
      if (res.ok) {
        const data = await res.json();
        const completed = data.payments?.find(
          (p: any) => p.startupId === startup.id && p.status === 'completed'
        );
        if (completed) {
          setHasPurchased(true);
          setPaymentId(completed.id);
        }
      }
    } catch (err) {
      console.error("Check purchase error:", err);
    }
  };

  const fetchSellerReviews = async () => {
    if (!startup?.userId) return;
    try {
      const res = await fetch(`/api/users/${startup.userId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setSellerReviewsData(data);
      }
    } catch (err) {
      console.error("Error fetching seller reviews:", err);
    }
  };

  useEffect(() => {
    if (!startup) return;
    checkPurchase();
    fetchSellerReviews();
  }, [startup?.id, startup?.userId]);



  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startup) return;
    if (!reviewComment.trim()) {
      onActionToast("Iltimos, sharh matnini yozing.");
      return;
    }
    setIsSubmittingReview(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment,
          startupId: startup.id
        })
      });

      if (res.ok) {
        onActionToast("Sharhingiz muvaffaqiyatli chop etildi!");
        setIsReviewModalOpen(false);
        setReviewComment("");
        fetchSellerReviews();
      } else {
        const err = await res.json();
        onActionToast(err.error || "Xatolik yuz berdi.");
      }
    } catch (err) {
      onActionToast("Server bilan aloqa uzildi.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason.trim() || !disputeDescription.trim()) {
      onActionToast("Barcha maydonlarni to'ldiring.");
      return;
    }
    setIsSubmittingDispute(true);
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId,
          reason: disputeReason,
          description: disputeDescription
        })
      });

      if (res.ok) {
        onActionToast("Nizo muvaffaqiyatli ochildi. Admin tez orada ko'rib chiqadi!");
        setIsDisputeModalOpen(false);
        setDisputeReason("");
        setDisputeDescription("");
      } else {
        const err = await res.json();
        onActionToast(err.error || "Xatolik yuz berdi.");
      }
    } catch (err) {
      onActionToast("Server bilan aloqa uzildi.");
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const fetchIdeas = async () => {
    if (!startup) return;
    setIsLoadingIdeas(true);
    try {
      const res = await fetch(`/api/startups/${startup.id}/ideas`);
      if (res.ok) {
        const data = await res.json();
        setIdeas(data);
      }
    } catch (err) {
      console.error("Fetch ideas error:", err);
    } finally {
      setIsLoadingIdeas(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, [startup?.id]);

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startup) return;
    if (!newIdeaContent.trim()) {
      onActionToast("Iltimos, g'oya matnini kiriting.");
      return;
    }

    setIsSubmittingIdea(true);
    try {
      const body: any = {
        content: newIdeaContent,
      };
      if (newIdeaAuthor.trim()) {
        body.authorName = newIdeaAuthor;
      }

      const res = await fetch(`/api/startups/${startup.id}/ideas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onActionToast("G'oya muvaffaqiyatli chop etildi!");
        setNewIdeaContent('');
        setNewIdeaAuthor('');
        fetchIdeas(); // Refresh ranking
      } else {
        const err = await res.json();
        onActionToast(err.error || "G'oyani chop etib bo'lmadi.");
      }
    } catch (err) {
      console.error("Submit idea error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsSubmittingIdea(false);
    }
  };

  const handleUpvoteIdea = async (ideaId: number) => {
    const storageKey = `savdo24_upvoted_${ideaId}`;
    if (localStorage.getItem(storageKey)) {
      onActionToast("Siz ushbu g'oyaga allaqachon ovoz bergansiz.");
      return;
    }
    if (votingIdeaIds.has(ideaId)) return; // so'rov allaqachon yuborilmoqda

    setVotingIdeaIds(prev => new Set(prev).add(ideaId));
    try {
      const res = await fetch(`/api/ideas/${ideaId}/upvote`, {
        method: 'POST',
      });
      if (res.ok) {
        localStorage.setItem(storageKey, 'true');
        onActionToast("Ovoz berildi!");
        setIdeas((prev) =>
          prev
            .map((idea) =>
              idea.id === ideaId ? { ...idea, upvotes: idea.upvotes + 1 } : idea
            )
            .sort((a, b) => b.upvotes - a.upvotes)
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        onActionToast(errData.error || "Ovoz berishda xatolik yuz berdi.");
        if (res.status === 409) {
          localStorage.setItem(storageKey, 'true');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVotingIdeaIds(prev => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
    }
  };


  // Dynamic tech stack based on project data
  const techStack = (startup?.techStack || []).map((tech) => {
    const lower = tech.toLowerCase();
    let icon = 'code';
    if (lower.includes('react') || lower.includes('vue') || lower.includes('angular') || lower.includes('next')) icon = 'javascript';
    else if (lower.includes('python') || lower.includes('django') || lower.includes('fastapi')) icon = 'terminal';
    else if (lower.includes('node') || lower.includes('express') || lower.includes('nest')) icon = 'dns';
    else if (lower.includes('mongo') || lower.includes('sql') || lower.includes('db') || lower.includes('postgres') || lower.includes('sqlite') || lower.includes('prisma')) icon = 'database';
    else if (lower.includes('solidity') || lower.includes('eth') || lower.includes('web3') || lower.includes('crypto')) icon = 'currency_bitcoin';
    else if (lower.includes('html') || lower.includes('css') || lower.includes('tailwind')) icon = 'css';
    
    return { name: tech, icon, desc: `${tech} texnologiyasida yozilgan modullar.` };
  });

  const isOwnListing = !!(user && startup && user.id === startup.userId);

  const handlePurchaseClick = () => {
    if (!startup) return;
    // 91-band: o'z e'loningizni sotib olishning oldini olish (server ham tekshiradi)
    if (isOwnListing) {
      onActionToast("O'z loyihangizni sotib ololmaysiz.");
      return;
    }
    // MUHIM: avval bu yerda narx yo'q/0 bo'lsa "$250" degan o'zboshimchalik
    // bilan o'ylab topilgan summa qo'llanilardi — bu haqiqatda 0 narxli
    // (yoki hali narxlanmagan) e'lon uchun foydalanuvchidan noto'g'ri summa
    // undirib olinishiga olib kelishi mumkin edi. Endi narx haqiqatan ham
    // yaroqsiz bo'lsa, xaridni to'xtatib xato ko'rsatamiz.
    const amt = Number(startup.price);
    if (!amt || isNaN(amt) || amt <= 0) {
      onActionToast("Ushbu e'lon uchun narx to'g'ri belgilanmagan. Sotuvchi bilan bog'laning.");
      return;
    }
    // MUHIM: DetailPage sotilayotgan mahsulotni URL'dagi :id orqali (useParams)
    // aniqlaydi, lekin CheckoutPage/App.tsx esa to'lov qilinadigan mahsulotni
    // butunlay boshqa, ilova darajasidagi `selectedStartupId` state'idan oladi —
    // bu state faqat BrowsePage/IdeasRatingPage ro'yxatidan yoki bildirishnoma
    // orqali bosilganda o'rnatiladi. Agar foydalanuvchi ushbu sahifaga
    // to'g'ridan-to'g'ri havola orqali kirsa (ulashilgan link, qidiruv
    // natijasi) yoki sahifani yangilasa (F5), bu state bo'sh qolib ketardi va
    // "Sotib olish" tugmasi har doim "mahsulot tanlanmagan" xatosi bilan
    // checkout'ni bekor qilardi — hattoki ekranda aynan shu mahsulot ko'rinib
    // turgan bo'lsa ham. Endi xarid tugmasi bosilganda ilova darajasidagi
    // tanlangan ID ham joriy mahsulotga sinxronlanadi.
    if (setSelectedStartupId) setSelectedStartupId(startup.id);
    setCheckoutAmount(amt);
    setView('checkout');
    onActionToast(`To'lov sahifasiga yo'naltirilmoqda...`);
  };

  const handleContactSeller = async () => {
    if (!startup) return;
    if (!user || user.name === 'Mehmon') {
      onActionToast("Iltimos, suhbatni boshlash uchun tizimga kiring.");
      return;
    }
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startupId: startup.id, sellerId: startup.userId })
      });
      if (res.ok) {
        setView('messages');
      } else {
        onActionToast("Suhbatni boshlab bo'lmadi.");
      }
    } catch (err) {
      console.error(err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    }
  };

  // Barcha Hook'lar yuqorida e'lon qilingandan KEYIN — endi startup mavjudligini
  // tekshirib, mos JSX qaytaramiz (Hooks tartib qoidasini buzmaslik uchun).
  if (!startup && startups.length > 0) {
    return <Navigate to="/" replace />;
  }

  if (!startup) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-secondary/20 border-text-secondary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in text-left">
      {/* Hero Section / Gallery Bento Grid */}
      <DetailHeroSection
        startup={startup}
        handleContactSeller={handleContactSeller}
      />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left column: Overview, stack, team, milestones, ideas, reviews */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* About Section */}
          <section className="bg-white/5 dark:bg-primary-container/20 border border-outline-variant/10 rounded-2xl p-6 md:p-8">
            <h2 className="text-secondary-container font-extrabold text-xl md:text-2xl mb-4">
              {startup.name} haqida
            </h2>
            <div className="text-on-surface dark:text-on-primary-container text-sm md:text-base leading-relaxed space-y-4 whitespace-pre-line">
              {startup.longDescription}
            </div>
          </section>

          {/* Technical Specifications Section & Tech Stack */}
          <DetailTechnicalSpecs
            parsedAttrs={parsedAttrs}
            attributeLabels={attributeLabels}
            techStack={techStack}
          />

          {/* Executive Team */}
          <section>
            <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-6">
              Ijroiya jamoasi
            </h3>
            <div className="flex flex-wrap gap-8">
              {startup.team.map((member) => (
                <div key={member.name} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5 min-w-[280px]">
                  <img
                    className="w-16 h-16 rounded-full object-cover border-2 border-secondary-container shadow-md"
                    src={member.imgUrl}
                    alt={`${member.name} - ${member.role}`}
                    loading="lazy"
                    width={64}
                    height={64}
                  />
                  <div>
                    <h4 className="text-white font-extrabold text-sm">{member.name}</h4>
                    <p className="text-on-primary-container text-xs mt-0.5">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Loyiha bosqichlari (Milestones) */}
          {startup.milestones && startup.milestones.length > 0 && (
            <section>
              <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-6">
                Loyiha bosqichlari
              </h3>
              <div className="space-y-4">
                {startup.milestones.map((m, idx) => (
                  <div key={idx} className="flex gap-4 bg-white/5 dark:bg-primary-container/20 border border-outline-variant/10 rounded-xl p-5">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span className="w-3 h-3 rounded-full bg-secondary mt-1" />
                      {idx < startup.milestones.length - 1 && (
                        <span className="w-px flex-1 bg-white/10 mt-1" />
                      )}
                    </div>
                    <div className="pb-1">
                      {m.date && (
                        <span className="text-xs text-secondary font-mono font-bold uppercase tracking-wider block mb-1">
                          {m.date}
                        </span>
                      )}
                      <h4 className="text-white font-extrabold text-sm">{m.title}</h4>
                      {m.desc && (
                        <p className="text-on-primary-container text-xs mt-1 leading-relaxed">{m.desc}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ideas Rating System Section */}
          <DetailIdeasSection
            ideas={ideas}
            isLoadingIdeas={isLoadingIdeas}
            votingIdeaIds={votingIdeaIds}
            handleUpvoteIdea={handleUpvoteIdea}
            handleOpenReportModal={handleOpenReportModal}
            newIdeaContent={newIdeaContent}
            setNewIdeaContent={setNewIdeaContent}
            newIdeaAuthorName={newIdeaAuthor}
            setNewIdeaAuthorName={setNewIdeaAuthor}
            isSubmittingIdea={isSubmittingIdea}
            handleSubmitIdea={handleSubmitIdea}
            isLoggedIn={!!(user && user.name !== 'Mehmon')}
          />

          {/* Seller Reviews List */}
          {sellerReviewsData && sellerReviewsData.reviews && sellerReviewsData.reviews.length > 0 && (
            <section className="bg-white/5 dark:bg-primary-container/20 border border-outline-variant/10 rounded-2xl p-6 md:p-8 space-y-6">
              <h3 className="text-secondary-container font-extrabold text-xl md:text-2xl flex items-center gap-2">
                <MessageSquare className="text-secondary w-5 h-5" />
                Sotuvchi haqida sharhlar ({sellerReviewsData.totalReviews})
              </h3>
              <div className="space-y-4">
                {sellerReviewsData.reviews.map((rev: any) => (
                  <div key={rev.id} className="p-4 bg-background/50 border border-white/5 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={rev.buyer?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${rev.buyer?.name}`}
                          alt={`${rev.buyer?.name || 'Xaridor'} avatari`}
                          className="w-8 h-8 rounded-full border border-white/10"
                          loading="lazy"
                          width={32}
                          height={32}
                        />
                        <div>
                          <span className="text-white font-bold text-xs block">{rev.buyer?.name}</span>
                          <span className="text-xs text-on-primary-container block">
                            {formatDate(rev.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < rev.rating ? "text-secondary fill-secondary" : "text-gray-600"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed italic">
                      "{rev.comment}"
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column: Sticky Widget */}
        <DetailSidebar
          startup={startup}
          categories={categories}
          isOwnListing={isOwnListing}
          isBookmarked={isBookmarked}
          handlePurchaseClick={handlePurchaseClick}
          toggleBookmark={toggleBookmark}
          onActionToast={onActionToast}
          handleOpenReportModal={handleOpenReportModal}
          sellerReviewsData={sellerReviewsData}
          hasPurchased={hasPurchased}
          setIsReviewModalOpen={setIsReviewModalOpen}
          setIsDisputeModalOpen={setIsDisputeModalOpen}
        />
      </div>

      {/* Review, Dispute, Report Modals */}
      <DetailModals
        isReviewModalOpen={isReviewModalOpen}
        setIsReviewModalOpen={setIsReviewModalOpen}
        reviewRating={reviewRating}
        setReviewRating={setReviewRating}
        reviewComment={reviewComment}
        setReviewComment={setReviewComment}
        isSubmittingReview={isSubmittingReview}
        handleReviewSubmit={handleReviewSubmit}

        isDisputeModalOpen={isDisputeModalOpen}
        setIsDisputeModalOpen={setIsDisputeModalOpen}
        disputeReason={disputeReason}
        setDisputeReason={setDisputeReason}
        disputeDescription={disputeDescription}
        setDisputeDescription={setDisputeDescription}
        isSubmittingDispute={isSubmittingDispute}
        handleDisputeSubmit={handleDisputeSubmit}

        reportModalOpen={reportModalOpen}
        setReportModalOpen={setReportModalOpen}
        reportReason={reportReason}
        setReportReason={setReportReason}
        reportDescription={reportDescription}
        setReportDescription={setReportDescription}
        isSubmittingReport={isSubmittingReport}
        handleReportSubmit={handleReportSubmit}
      />
    </div>
  );
}
