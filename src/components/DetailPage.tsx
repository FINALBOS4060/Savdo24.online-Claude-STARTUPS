import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Startup, Idea, UserProfileData, Category } from '../types';
import { FIELD_LABELS } from '../categoryFields';
import { apiFetch as fetch } from '../lib/api';

interface DetailPageProps {
  startups: Startup[];
  setView: (view: string) => void;
  bookmarkedIds: string[];
  toggleBookmark: (id: string) => void;
  onActionToast: (message: string) => void;
  setCheckoutAmount: (amount: number) => void;
  user?: UserProfileData;
  categories: Category[];
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
}: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  
  // Find the current startup by ID from URL
  const startup = startups.find(s => s.id === id);

  // If not found and we have startups loaded, redirect to home
  if (!startup && startups.length > 0) {
    return <Navigate to="/" replace />;
  }

  // If startups are still loading or empty, show a loader or just wait
  if (!startup) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-[#f0b90b]/20 border-t-[#f0b90b] rounded-full animate-spin"></div>
      </div>
    );
  }

  const isBookmarked = bookmarkedIds.includes(startup.id);

  // Update SEO Meta Tags
  useEffect(() => {
    document.title = `${startup.name} | Savdo24`;
    
    const setMetaTag = (property: string, content: string) => {
      let element = document.querySelector(`meta[property="${property}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    setMetaTag('og:title', `${startup.name} - ${startup.slogan}`);
    setMetaTag('og:description', startup.description);
    setMetaTag('og:image', startup.image);
    setMetaTag('og:type', 'website');
    
    // Cleanup function when component unmounts
    return () => {
      document.title = 'Savdo24 | Startaplar bozori';
      // Ideally remove or reset the meta tags, but leaving them is generally harmless for SPAs
    };
  }, [startup]);

  // Parse dynamic category-specific attributes
  let parsedAttrs: Record<string, string> = {};
  if (startup.attributes) {
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
    if (!startup.userId) return;
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
    checkPurchase();
    fetchSellerReviews();
  }, [startup.id, startup.userId]);

  // Dynamically update document title and meta description for SEO
  useEffect(() => {
    if (startup) {
      document.title = `${startup.name} — Savdo24`;
      
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', startup.slogan || startup.description || `${startup.name} sotiladi.`);
      } else {
        const meta = document.createElement('meta');
        meta.name = "description";
        meta.content = startup.slogan || startup.description || `${startup.name} sotiladi.`;
        document.head.appendChild(meta);
      }
    }
    
    // Clean up to restore default values when leaving DetailPage
    return () => {
      document.title = "Savdo24 — Startaplar va raqamli loyihalar bozori";
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', "O'zbekistondagi eng yirik startaplar, loyihalar va raqamli bizneslar savdo maydonchasi.");
      }
    };
  }, [startup]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
  }, [startup.id]);

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (sessionStorage.getItem(storageKey)) {
      onActionToast("Siz ushbu g'oyaga allaqachon ovoz bergansiz.");
      return;
    }

    try {
      const res = await fetch(`/api/ideas/${ideaId}/upvote`, {
        method: 'POST',
      });
      if (res.ok) {
        sessionStorage.setItem(storageKey, 'true');
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
          sessionStorage.setItem(storageKey, 'true');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };


  // Dynamic tech stack based on project data
  const techStack = (startup.techStack || []).map((tech) => {
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

  const handlePurchaseClick = () => {
    const amt = startup.price || 250;
    setCheckoutAmount(amt);
    setView('checkout');
    onActionToast(`To'lov sahifasiga yo'naltirilmoqda...`);
  };

  const handleContactSeller = async () => {
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

  return (
    <div className="space-y-12 animate-fade-in text-left">
      {/* Hero Section / Gallery Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[500px]">
        <div className="md:col-span-2 md:row-span-2 relative overflow-hidden rounded-2xl border border-outline-variant/30 group">
          <img
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
            src={startup.image}
            alt={`${startup.name} - asosiy startap rasmi`}
            loading="lazy"
            width={600}
            height={500}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-container via-primary-container/40 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full p-6">
            <span className="px-3 py-1 bg-secondary-container text-on-secondary-fixed text-xs font-bold rounded-full mb-3 inline-block uppercase tracking-wider">
              {startup.slogan}
            </span>
            <h1 className="text-white font-extrabold text-2xl md:text-4xl mb-2 flex items-center gap-3">
              {startup.name}
              {startup.isTop && (
                <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">vertical_align_top</span>
                  TOP
                </span>
              )}
            </h1>
            <p className="text-on-primary-container text-xs md:text-sm max-w-md leading-relaxed">
              {startup.description}
            </p>
            <button
              onClick={handleContactSeller}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              💬 Sotuvchi bilan bog'lanish
            </button>
          </div>
        </div>

        {/* Dynamic / pre-filled auxiliary gallery slots */}
        {startup.gallery && startup.gallery[0] ? (
          <div className="hidden md:block relative overflow-hidden rounded-2xl border border-outline-variant/30 group">
            <img
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              src={startup.gallery[0]}
              alt={`${startup.name} - qo'shimcha galereya rasmi 1`}
              loading="lazy"
              width={280}
              height={240}
            />
          </div>
        ) : (
          <div className="hidden md:block bg-white/5 border border-dashed border-outline-variant/30 rounded-2xl flex items-center justify-center text-on-primary-container">
            <span className="material-symbols-outlined text-4xl">photo</span>
          </div>
        )}

        {startup.gallery && startup.gallery[1] ? (
          <div className="hidden md:block relative overflow-hidden rounded-2xl border border-outline-variant/30 group">
            <img
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              src={startup.gallery[1]}
              alt={`${startup.name} - qo'shimcha galereya rasmi 2`}
              loading="lazy"
              width={280}
              height={240}
            />
          </div>
        ) : (
          <div className="hidden md:block bg-white/5 border border-dashed border-outline-variant/30 rounded-2xl flex items-center justify-center text-on-primary-container">
            <span className="material-symbols-outlined text-4xl">photo</span>
          </div>
        )}

        {startup.gallery && startup.gallery[2] ? (
          <div className="hidden md:block md:col-span-2 relative overflow-hidden rounded-2xl border border-outline-variant/30 group">
            <img
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              src={startup.gallery[2]}
              alt={`${startup.name} - yordamchi banner muqovasi`}
              loading="lazy"
              width={580}
              height={240}
            />
          </div>
        ) : (
          <div className="hidden md:block md:col-span-2 bg-gradient-to-r from-secondary-container/10 to-transparent border border-outline-variant/30 rounded-2xl flex items-center justify-center text-secondary-container font-semibold">
            Startap media markazi
          </div>
        )}
      </section>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left column: Overview, stack, team, milestones */}
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

          {/* Technical Specifications Section */}
          {Object.keys(parsedAttrs).length > 0 && (
            <section className="bg-white/5 dark:bg-primary-container/20 border border-outline-variant/10 rounded-2xl p-6 md:p-8 space-y-6">
              <h3 className="text-secondary-container font-extrabold text-xl md:text-2xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[#f3ba2f]">settings_suggest</span>
                Texnik xususiyatlar
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(parsedAttrs).map(([key, value]) => {
                  const label = FIELD_LABELS[key] || attributeLabels[key] || key;
                  
                  // Pick visual material icons based on property key
                  let icon = "info";
                  if (key === 'teamSize') icon = "groups";
                  else if (key === 'stage') icon = "trending_up";
                  else if (key === 'pitchDeckUrl') icon = "link";
                  else if (key === 'targetAi') icon = "smart_toy";
                  else if (key === 'promptsCount') icon = "format_list_numbered";
                  else if (key === 'language') icon = "language";
                  else if (key === 'framework') icon = "architecture";
                  else if (key === 'modelSize') icon = "memory";
                  else if (key === 'datasetSource') icon = "folder_open";
                  else if (key === 'hasDomain') icon = "language";
                  else if (key === 'hasHosting') icon = "cloud";
                  else if (key === 'mau') icon = "show_chart";
                  else if (key === 'platformType') icon = "devices";
                  else if (key === 'additionalNotes') icon = "description";

                  // Convert booleans or other types safely to text or check status
                  let displayValue = String(value);
                  if (typeof value === 'boolean') {
                    displayValue = value ? "Bor (Kiritilgan) ✅" : "Yo'q (Mavjud emas) ❌";
                  }

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-4 p-4 bg-[#0b1426]/50 border border-white/5 rounded-xl hover:border-secondary-container/20 transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[#f3ba2f] text-xl">
                          {icon}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-on-primary-container uppercase font-extrabold tracking-wider block">
                          {label}
                        </span>
                        {key === 'pitchDeckUrl' && value && value !== "Ko'rsatilmagan" ? (
                          <a
                            href={String(value)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#f3ba2f] hover:underline text-xs md:text-sm font-semibold truncate block"
                          >
                            Taqdimot hujjati (Pitch deck) ↗
                          </a>
                        ) : (
                          <span className="text-white font-semibold text-xs md:text-sm break-words block">
                            {displayValue}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Proprietary Technology Stack */}
          <section>
            <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-6">
              Xususiy texnologiyalar to'plami
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {techStack.map((tech) => (
                <div
                  key={tech.name}
                  className="p-5 bg-white/5 dark:bg-primary-container/20 border border-outline-variant/20 rounded-xl hover:border-secondary-container/50 transition-colors"
                >
                  <span className="material-symbols-outlined text-secondary-container mb-3 text-3xl">
                    {tech.icon}
                  </span>
                  <h4 className="text-white font-bold text-sm mb-1">{tech.name}</h4>
                  <p className="text-on-primary-container text-xs leading-relaxed">{tech.desc}</p>
                </div>
              ))}
            </div>
          </section>

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



          {/* Ideas Rating System Section */}
          <section className="bg-[#0b1426] border border-[#f0b90b]/10 rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-secondary-container font-extrabold text-lg md:text-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#f3ba2f]">emoji_objects</span>
                  G'oyalar va Takliflar reytingi
                </h3>
                <p className="text-[11px] text-on-primary-container mt-0.5">
                  Startap rivojlanishi uchun g'oyalar yuboring yoki eng yaxshilariga ovoz bering.
                </p>
              </div>
              <span className="bg-yellow-500/10 text-[#f0b90b] text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border border-yellow-500/20 text-center self-start sm:self-auto">
                {ideas.length} ta g'oya
              </span>
            </div>

            {/* List of Ideas (Ranking Style) */}
            <div className="space-y-4">
              {isLoadingIdeas ? (
                <div className="py-8 text-center text-on-primary-container space-y-2">
                  <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
                  <p className="text-xs">G'oyalar yuklanmoqda...</p>
                </div>
              ) : ideas.length === 0 ? (
                <div className="py-8 text-center text-on-primary-container space-y-2 bg-white/2 border border-dashed border-white/5 rounded-xl">
                  <span className="material-symbols-outlined text-4xl opacity-30">lightbulb_outline</span>
                  <p className="text-xs font-semibold">Hozircha g'oyalar yo'q</p>
                  <p className="text-[10px] opacity-80">Birinchi bo'lib o'z foydali taklifingizni qo'shing!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {ideas.map((idea, index) => {
                    let rankBadge = `${index + 1}`;
                    let rankClass = "bg-white/10 text-white";
                    if (index === 0) {
                      rankBadge = "🥇";
                      rankClass = "bg-yellow-500/20 text-[#f0b90b] font-black border border-yellow-500/30";
                    } else if (index === 1) {
                      rankBadge = "🥈";
                      rankClass = "bg-slate-300/20 text-slate-300 font-bold border border-slate-300/20";
                    } else if (index === 2) {
                      rankBadge = "🥉";
                      rankClass = "bg-amber-700/20 text-amber-500 font-bold border border-amber-700/20";
                    }

                    return (
                      <div
                        key={idea.id}
                        className="bg-white/3 border border-white/5 hover:border-white/10 p-4 rounded-xl flex items-start gap-4 transition-all"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono shrink-0 ${rankClass}`}>
                          {rankBadge}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-white text-xs md:text-sm leading-relaxed font-medium break-words">
                            {idea.content}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-on-primary-container flex-wrap">
                            <span className="font-extrabold text-[#f3ba2f] flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">alternate_email</span>
                              {idea.authorName}
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(idea.createdAt).toLocaleDateString('uz-UZ', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => handleOpenReportModal('idea', String(idea.id))}
                              className="text-red-400 hover:text-red-300 font-bold hover:underline transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[10px]">flag</span>
                              Shikoyat qilish
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUpvoteIdea(idea.id)}
                          className="flex flex-col items-center justify-center gap-1 bg-white/4 hover:bg-[#f0b90b]/10 hover:border-[#f0b90b]/30 border border-white/5 rounded-xl px-3 py-2 transition-all active:scale-95 group shrink-0"
                        >
                          <span className="material-symbols-outlined text-[#f3ba2f] text-base group-hover:scale-110 transition-transform">
                            thumb_up
                          </span>
                          <span className="text-[10px] font-extrabold text-white font-mono">
                            {idea.upvotes}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submission Form */}
            <form onSubmit={handleSubmitIdea} className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3.5">
              <h4 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">add_comment</span>
                Taklifingizni qoldiring
              </h4>

              <div className="space-y-3">
                {!user && (
                  <div>
                    <label className="block text-[10px] text-on-primary-container uppercase font-extrabold tracking-wider mb-1">
                      Sizning ismingiz (Majburiy emas)
                    </label>
                    <input
                      type="text"
                      placeholder="Ism-sharifingiz yoki taxallusingiz"
                      value={newIdeaAuthor}
                      onChange={(e) => setNewIdeaAuthor(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-[#0b1426] border border-white/10 rounded-xl focus:border-secondary-container outline-none text-white font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-on-primary-container uppercase font-extrabold tracking-wider mb-1">
                    G'oya yoki taklif matni
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Masalan: Ushbu startap uchun mijozlarni jalb qilishning yangicha usuli..."
                    value={newIdeaContent}
                    onChange={(e) => setNewIdeaContent(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-[#0b1426] border border-white/10 rounded-xl focus:border-secondary-container outline-none text-white font-medium resize-none leading-relaxed"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-between items-center flex-wrap gap-2 pt-1">
                {user ? (
                  <p className="text-[10px] text-[#f3ba2f] flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-xs">person</span>
                    Tizimga kirilgan: {user.name}
                  </p>
                ) : (
                  <p className="text-[10px] text-on-primary-container">
                    Mehmon sifatida yuborish
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingIdea || !newIdeaContent.trim()}
                  className="px-4 py-2 bg-secondary-container disabled:opacity-40 hover:brightness-110 text-[#12161c] font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 shadow-md shadow-secondary-container/10 active:scale-95 cursor-pointer"
                >
                  {isSubmittingIdea ? (
                    <>
                      <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                      Yuborilmoqda...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xs">send</span>
                      Chop etish
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* Seller Reviews List */}
          {sellerReviewsData && sellerReviewsData.reviews && sellerReviewsData.reviews.length > 0 && (
            <section className="bg-white/5 dark:bg-primary-container/20 border border-outline-variant/10 rounded-2xl p-6 md:p-8 space-y-6">
              <h3 className="text-secondary-container font-extrabold text-xl md:text-2xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[#f3ba2f]">reviews</span>
                Sotuvchi haqida sharhlar ({sellerReviewsData.totalReviews})
              </h3>
              <div className="space-y-4">
                {sellerReviewsData.reviews.map((rev: any) => (
                  <div key={rev.id} className="p-4 bg-[#0b1426]/50 border border-white/5 rounded-xl space-y-2">
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
                          <span className="text-on-primary-container text-[10px] block">
                            {new Date(rev.createdAt).toLocaleDateString("uz-UZ")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`material-symbols-outlined text-xs ${
                              i < rev.rating ? "text-[#f3ba2f] fill-1" : "text-gray-600"
                            }`}
                          >
                            star
                          </span>
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
        <aside className="lg:sticky lg:top-24 space-y-6">
          <div className="p-6 bg-[#0e1726]/95 border border-outline-variant/20 rounded-2xl shadow-xl space-y-6">
            <div>
              <span className="text-[10px] text-on-primary-container uppercase font-extrabold tracking-wider block mb-1">
                Sotish narxi
              </span>
              <div className="text-3xl md:text-4xl font-black font-mono text-[#f3ba2f] tracking-tight">
                ${startup.price ? startup.price.toLocaleString() : "Kelishilgan holda"}
              </div>
            </div>

            <div className="space-y-3">
              {/* Primary "Sotib olish" Button */}
              <button
                onClick={handlePurchaseClick}
                className="w-full py-4 bg-[#f3ba2f] hover:brightness-110 text-[#12161c] font-black text-sm rounded-xl active:scale-95 transition-all shadow-lg shadow-yellow-500/10 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">shopping_cart</span>
                {startup.soldStatus === 'sotildi' ? "Sotilgan (Band qilingan)" : "Loyihani sotib olish"}
              </button>

              {/* Demo URL Button */}
              {startup.demoUrl && (
                <a
                  href={startup.demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-95 text-center uppercase tracking-wider"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  Demoni ko'rish
                </a>
              )}

              {/* Bookmark Button */}
              <button
                onClick={() => {
                  toggleBookmark(startup.id);
                  onActionToast(
                    isBookmarked
                      ? `${startup.name} xatcho'plardan olib tashlandi.`
                      : `${startup.name} xatcho'plarga qo'shildi!`
                  );
                }}
                className="w-full py-3 border border-white/10 hover:bg-white/5 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wider"
              >
                <span
                  className="material-symbols-outlined text-base leading-none"
                  style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
                >
                  bookmark
                </span>
                <span>{isBookmarked ? "Saqlab qo'yilgan" : "Saqlab qo'yish"}</span>
              </button>

              {/* Report Button */}
              <button
                onClick={() => handleOpenReportModal('startup', startup.id)}
                className="w-full py-3 border border-red-500/30 hover:bg-red-500/10 text-red-400 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-wider"
              >
                <span className="material-symbols-outlined text-base text-red-500">
                  flag
                </span>
                <span>🚩 Shikoyat qilish</span>
              </button>
            </div>

            {/* Other details in small font */}
            <div className="border-t border-white/5 pt-4 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-on-primary-container font-medium">E'lon turi</span>
                <span className="text-white font-semibold">{startup.listingType || "To'liq loyiha (manba kodi bilan)"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-primary-container font-medium">Manba kodi (Repo)</span>
                <span className="text-white font-semibold">{startup.repoIncluded ? "Kiritilgan ✅" : "Mavjud emas ❌"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-primary-container font-medium">Sotuv holati</span>
                <span>
                  {startup.soldStatus === 'sotildi' ? (
                    <span className="text-red-500 font-extrabold flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      Sotildi
                    </span>
                  ) : (
                    <span className="text-green-500 font-extrabold flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Sotuvda
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Tech Stack Chips Block */}
            {startup.techStack && startup.techStack.length > 0 && (
              <div className="border-t border-white/5 pt-4 space-y-2.5">
                <span className="text-[10px] text-on-primary-container uppercase font-extrabold tracking-wider block">
                  Texnologiyalar
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {startup.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-[#f3ba2f] flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 bg-[#f3ba2f] rounded-full"></span>
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sotuvchi va Reyting */}
          {startup.userId && (
            <div className="p-6 bg-[#0e1726]/95 border border-outline-variant/20 rounded-2xl shadow-xl space-y-4">
              <span className="text-[10px] text-on-primary-container uppercase font-extrabold tracking-wider block">
                Sotuvchi ma'lumotlari
              </span>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary-container font-black text-lg border border-secondary-container/20">
                  {sellerReviewsData?.sellerName ? sellerReviewsData.sellerName[0].toUpperCase() : "S"}
                </div>
                <div>
                  <h4 className="text-white font-extrabold text-sm">
                    {sellerReviewsData?.sellerName || "Sotuvchi"}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="material-symbols-outlined text-[#f3ba2f] text-sm fill-1">star</span>
                    <span className="text-white text-xs font-bold font-mono">
                      {sellerReviewsData?.averageRating || "0.0"}
                    </span>
                    <span className="text-on-primary-container text-[11px]">
                      ({sellerReviewsData?.totalReviews || 0} sharh)
                    </span>
                  </div>
                </div>
              </div>

              {/* Show "Sharh qoldirish" and "Nizo ochish" if purchased */}
              {hasPurchased && (
                <div className="border-t border-white/5 pt-4 space-y-2">
                  <button
                    onClick={() => setIsReviewModalOpen(true)}
                    className="w-full py-2.5 bg-secondary-container/10 hover:bg-secondary-container/20 border border-secondary-container/30 text-secondary-container rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">rate_review</span>
                    Sharh qoldirish
                  </button>
                  <button
                    onClick={() => setIsDisputeModalOpen(true)}
                    className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">gavel</span>
                    Nizo ochish
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Hamkorlar va Maslahatchilar */}
          <div className="p-6 border border-outline-variant/20 rounded-2xl bg-white/5 dark:bg-primary-container/20">
            <h4 className="text-white font-bold text-xs tracking-wider uppercase mb-4">YETAKCHI HAMKORLAR VA MASLAHATChILAR</h4>
            <div className="flex -space-x-3 mb-4">
              {[
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop",
                "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=80&fit=crop"
              ].map((logo, index) => (
                <img
                  key={index}
                  className="w-10 h-10 rounded-full border-2 border-[#0b1426] bg-white object-cover shadow-sm"
                  src={logo}
                  alt={`Maslahatchi professional hamkor ${index + 1}`}
                  loading="lazy"
                  width={40}
                  height={40}
                />
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-[#0b1426] bg-secondary-container flex items-center justify-center text-[9px] font-bold text-[#12161c] shadow-sm">
                +12
              </div>
            </div>
            <p className="text-on-primary-container text-xs leading-relaxed">
              15 ta faol jamoa, hamkorlar va professional maslahatchilar ushbu loyihani qo'llab-quvvatlamoqda.
            </p>
          </div>
        </aside>
      </div>

      {/* Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0e1726] border border-outline-variant/30 rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsReviewModalOpen(false)}
              className="absolute top-4 right-4 text-on-primary-container hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-white font-black text-lg">Loyiha va Sotuvchi haqida sharh</h3>
              <p className="text-xs text-on-primary-container">Ushbu loyiha haqidagi fikr-mulohazalaringizni bildiring.</p>
            </div>
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-on-primary-container font-extrabold uppercase">Reyting (Yulduzchalar)</label>
                <div className="flex items-center gap-1.5 justify-center py-2 bg-white/5 rounded-xl border border-white/5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="text-2xl transition-all active:scale-90 hover:scale-110 cursor-pointer"
                    >
                      <span
                        className={`material-symbols-outlined text-3xl ${
                          star <= reviewRating ? "text-[#f3ba2f] fill-1" : "text-gray-600"
                        }`}
                      >
                        star
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-on-primary-container font-extrabold uppercase">Fikr va mulohazalar</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Loyihaning sifati, kod tozaligi va sotuvchining muloqoti haqida yozing..."
                  rows={4}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-on-primary-container/60 focus:border-secondary-container focus:outline-none transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview || !reviewComment.trim()}
                  className="flex-1 py-3 bg-[#f3ba2f] hover:brightness-110 disabled:opacity-40 text-[#12161c] font-black text-xs rounded-xl transition-all animate-none"
                >
                  {isSubmittingReview ? "Yuborilmoqda..." : "Sharh qoldirish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {isDisputeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0e1726] border border-outline-variant/30 rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsDisputeModalOpen(false)}
              className="absolute top-4 right-4 text-on-primary-container hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-red-400 font-black text-lg flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined">gavel</span>
                Nizo (Dispute) ochish
              </h3>
              <p className="text-xs text-on-primary-container">Muammoni hal qilish maqsadida administratorga nizo arizasini yuborish.</p>
            </div>
            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-on-primary-container font-extrabold uppercase">Nizo sababi</label>
                <input
                  type="text"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Masalan: Fayllar to'liq emas, Sotuvchi Telegramda javob bermayapti"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-on-primary-container/60 focus:border-red-500 focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-on-primary-container font-extrabold uppercase">Batafsil tavsif</label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Muammo haqida barcha tafsilotlarni qoldiring. Loyiha topshirilmadi yoki va'da qilingan texnik standartga mos kelmasligi sabablarini tushuntirib bering..."
                  rows={4}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-on-primary-container/60 focus:border-red-500 focus:outline-none transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisputeModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute || !disputeReason.trim() || !disputeDescription.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all"
                >
                  {isSubmittingDispute ? "Yuborilmoqda..." : "Nizo ochish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report (Shikoyat qilish) Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0e1726] border border-outline-variant/30 rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setReportModalOpen(false)}
              className="absolute top-4 right-4 text-on-primary-container hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-red-400 font-black text-lg flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-red-500">flag</span>
                Shikoyat qilish (Report)
              </h3>
              <p className="text-xs text-on-primary-container">E'lon yoki kontentdagi qonunbuzarliklar haqida adminstratsiyaga xabar berish.</p>
            </div>
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-on-primary-container font-extrabold uppercase">Shikoyat sababi</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-3 bg-[#162235] border border-white/10 rounded-xl text-white text-xs focus:border-red-500 focus:outline-none transition-all font-semibold"
                >
                  <option value="Firibgar elon">Firibgar elon</option>
                  <option value="Zararli havola">Zararli havola</option>
                  <option value="Nomaqbul kontent">Nomaqbul kontent</option>
                  <option value="Boshqa">Boshqa</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-on-primary-container font-extrabold uppercase">Tafsilotlar (Ixtiyoriy)</label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Shikoyatingizni asoslovchi qo'shimcha tafsilotlarni yozing..."
                  rows={4}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-on-primary-container/60 focus:border-red-500 focus:outline-none transition-all font-medium"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all"
                >
                  {isSubmittingReport ? "Yuborilmoqda..." : "Shikoyat yuborish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
