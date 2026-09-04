import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Lightbulb,
  RefreshCw,
  User,
  Rocket,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Idea, Category } from '../types';
import { apiFetch as fetch } from '../lib/api';
import { formatDate } from '../lib/formatDate';

interface IdeasRatingPageProps {
  setView: (view: string) => void;
  setSelectedStartupId: (id: string) => void;
  onActionToast: (message: string) => void;
  categories: Category[];
}

interface RankedStartup {
  id: string;
  name: string;
  category: string;
  image: string;
  totalUpvotes: number;
  ideaCount: number;
  topIdeas: Idea[];
}

export default function IdeasRatingPage({
  setView,
  setSelectedStartupId,
  onActionToast,
  categories,
}: IdeasRatingPageProps) {
  const [startups, setStartups] = useState<RankedStartup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const limit = 15; // Number of items per page
  const requestIdRef = React.useRef(0);
  const [votingIds, setVotingIds] = useState<Set<number>>(new Set());

  const fetchTopStartups = async () => {
    setIsLoading(true);
    const requestId = ++requestIdRef.current;
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        category: categoryFilter,
        time: timeFilter,
      });

      const res = await fetch(`/api/startups/top-rated?${queryParams.toString()}`);
      if (requestId !== requestIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        setStartups(data.startups);
        setTotalPages(data.pagination.pages || 1);
        setTotalItems(data.pagination.total || 0);
      } else {
        onActionToast("Ma'lumotlarni yuklab bo'lmadi.");
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("Fetch top startups error:", err);
      onActionToast("Tarmoq ulanishida xatolik.");
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopStartups();
  }, [categoryFilter, timeFilter, page]);

  const handleCategoryChange = (cat: string) => {
    setCategoryFilter(cat);
    setPage(1);
  };

  const handleTimeChange = (time: string) => {
    setTimeFilter(time);
    setPage(1);
  };

  const handleUpvote = async (ideaId: number, startupId: string) => {
    const storageKey = `savdo24_upvoted_${ideaId}`;
    if (localStorage.getItem(storageKey)) {
      onActionToast("Siz ushbu g'oyaga allaqachon ovoz bergansiz.");
      return;
    }
    if (votingIds.has(ideaId)) return;

    setVotingIds((prev) => new Set(prev).add(ideaId));
    try {
      const res = await fetch(`/api/ideas/${ideaId}/upvote`, {
        method: 'POST',
      });
      if (res.ok) {
        localStorage.setItem(storageKey, 'true');
        onActionToast("Ovoz berildi!");
        setStartups((prev) =>
          prev
            .map((s) =>
              s.id === startupId
                ? {
                    ...s,
                    totalUpvotes: s.totalUpvotes + 1,
                    topIdeas: s.topIdeas.map((idea) =>
                      idea.id === ideaId ? { ...idea, upvotes: idea.upvotes + 1 } : idea
                    ),
                  }
                : s
            )
            .sort((a, b) => b.totalUpvotes - a.totalUpvotes)
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
      setVotingIds((prev) => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
    }
  };

  const handleStartupClick = (startupId: string) => {
    setSelectedStartupId(startupId);
    setView('detail');
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-on-primary-container mb-2 flex items-center gap-2.5">
            <Trophy className="text-secondary w-7 h-7" />
            Loyihalar reytingi
          </h1>
          <p className="text-xs md:text-sm text-on-primary-container leading-relaxed">
            Foydalanuvchilar tomonidan taklif etilgan g'oyalarga to'plangan ovozlar bo'yicha eng sara loyihalar reytingi.
          </p>
        </div>
        <div className="bg-secondary-container/10 border border-secondary/20 px-4 py-2 rounded-2xl flex items-center gap-2 self-start md:self-auto">
          <Rocket className="text-secondary w-4 h-4" />
          <span className="text-xs text-on-primary-container font-extrabold">Jami: {totalItems} ta loyiha</span>
        </div>
      </div>

      {/* Filters section */}
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-5 md:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Time Filters */}
          <div className="flex items-center gap-2 bg-surface-container border border-white/5 p-1.5 rounded-xl self-start">
            {[
              { id: 'all', label: 'Barchasi' },
              { id: 'week', label: 'Shu hafta' },
              { id: 'today', label: 'Bugun' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => handleTimeChange(t.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-secondary ${
                  timeFilter === t.id
                    ? 'bg-secondary text-on-secondary'
                    : 'text-on-primary-container hover:text-on-primary-container'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Category Filter Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-on-primary-container hidden sm:inline">Kategoriya:</span>
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="px-4 py-2 bg-surface-container border border-white/10 rounded-xl outline-none text-on-primary-container text-xs font-bold focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
            >
              <option value="all">Barcha kategoriyalar</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Projects Ranking List */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-secondary animate-spin mx-auto" />
            <p className="text-sm text-on-primary-container font-semibold">Loyihalar yuklanmoqda...</p>
          </div>
        ) : startups.length === 0 ? (
          <div className="py-16 text-center space-y-3 border border-dashed border-white/5 rounded-2xl bg-white/1">
            <Lightbulb className="w-12 h-12 text-on-primary-container opacity-30 mx-auto" />
            <p className="text-sm text-on-primary-container font-extrabold">Mos keluvchi loyihalar topilmadi</p>
            <p className="text-xs text-on-primary-container">Kategoriya yoki vaqt filtrlarini o'zgartirib ko'ring.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {startups.map((startup, index) => {
              const globalIndex = (page - 1) * limit + index + 1;
              let rankBadge = `${globalIndex}`;
              let rankClass = "bg-surface-container text-on-primary-container border border-white/5";
              if (globalIndex === 1) {
                rankBadge = "🥇";
                rankClass = "bg-secondary/20 text-secondary font-black border border-secondary/30 shadow-lg shadow-secondary/5";
              } else if (globalIndex === 2) {
                rankBadge = "🥈";
                rankClass = "bg-slate-300/20 text-slate-300 font-bold border border-slate-300/20";
              } else if (globalIndex === 3) {
                rankBadge = "🥉";
                rankClass = "bg-amber-700/20 text-amber-500 font-bold border border-amber-700/20";
              }

              return (
                <div
                  key={startup.id}
                  className="bg-surface-container-low border border-white/5 hover:border-white/10 rounded-2xl p-5 space-y-4 transition-all"
                >
                  {/* Project header row */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Rank Badge */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-mono shrink-0 font-bold ${rankClass}`}>
                        {rankBadge}
                      </div>

                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {startup.image && (
                          <img
                            src={startup.image}
                            alt={startup.name}
                            className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <button
                            onClick={() => handleStartupClick(startup.id)}
                            className="text-on-primary-container font-extrabold text-sm md:text-base hover:underline hover:text-secondary text-left flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-secondary rounded"
                          >
                            <Rocket className="w-4 h-4 text-secondary shrink-0" />
                            <span className="truncate">{startup.name}</span>
                          </button>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs uppercase bg-white/5 px-1.5 py-0.5 rounded-lg border border-white/5">
                              {categories.find((c) => c.id === startup.category)?.name || startup.category}
                            </span>
                            <span className="text-xs text-on-primary-container">
                              {startup.ideaCount} ta g'oya
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Total rating */}
                    <div className="w-full md:w-auto flex items-center justify-center gap-2 bg-secondary/10 border border-secondary/20 rounded-xl px-4 py-2.5 shrink-0">
                      <ThumbsUp className="w-4 h-4 text-secondary" />
                      <span className="text-xs font-extrabold text-secondary font-mono">
                        {startup.totalUpvotes} ta ovoz
                      </span>
                    </div>
                  </div>

                  {/* Top ideas for this project */}
                  {startup.topIdeas.length > 0 && (
                    <div className="pl-0 md:pl-14 space-y-2 border-t border-white/5 pt-4">
                      {startup.topIdeas.map((idea) => (
                        <div
                          key={idea.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/2 border border-white/5 rounded-xl p-3"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <p className="text-on-primary-container text-xs leading-relaxed font-semibold break-words">
                              {idea.content}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-on-primary-container flex-wrap">
                              <span className="font-extrabold text-secondary flex items-center gap-1 bg-secondary/10 px-2 py-0.5 rounded-lg border border-secondary/10">
                                <User className="w-3 h-3" />
                                {idea.authorName}
                              </span>
                              <span>•</span>
                              <span className="bg-white/5 px-2 py-0.5 rounded-lg text-xs border border-white/5">
                                {formatDate(idea.createdAt, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleUpvote(idea.id, startup.id)}
                            disabled={votingIds.has(idea.id)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/3 hover:bg-secondary/10 hover:border-secondary/30 border border-white/5 rounded-xl px-3 py-2 transition-all active:scale-95 group shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
                          >
                            <ThumbsUp className="w-3.5 h-3.5 text-secondary group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-extrabold text-on-primary-container font-mono">
                              {idea.upvotes} ta ovoz
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 bg-white/3 text-on-primary-container text-xs font-bold rounded-xl hover:bg-white/5 disabled:opacity-30 transition-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Oldingi
            </button>
            <span className="text-xs font-bold text-on-primary-container">
              Sahifa {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 bg-white/3 text-on-primary-container text-xs font-bold rounded-xl hover:bg-white/5 disabled:opacity-30 transition-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              Keyingi
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
