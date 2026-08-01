import React, { useState, useEffect } from 'react';
import { Idea, Category } from '../types';
import { apiFetch as fetch } from '../lib/api';
import { formatDate } from '../lib/formatDate';

interface IdeasRatingPageProps {
  setView: (view: string) => void;
  setSelectedStartupId: (id: string) => void;
  onActionToast: (message: string) => void;
  categories: Category[];
}

interface TopIdea extends Idea {
  startup?: {
    name: string;
    category: string;
  };
}

export default function IdeasRatingPage({
  setView,
  setSelectedStartupId,
  onActionToast,
  categories,
}: IdeasRatingPageProps) {
  const [ideas, setIdeas] = useState<TopIdea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const limit = 15; // Number of items per page
  const requestIdRef = React.useRef(0);
  const [votingIds, setVotingIds] = useState<Set<number>>(new Set());

  const fetchTopIdeas = async () => {
    setIsLoading(true);
    const requestId = ++requestIdRef.current;
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        category: categoryFilter,
        time: timeFilter,
      });

      const res = await fetch(`/api/ideas/top?${queryParams.toString()}`);
      if (requestId !== requestIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        setIdeas(data.ideas);
        setTotalPages(data.pagination.pages || 1);
        setTotalItems(data.pagination.total || 0);
      } else {
        onActionToast("Ma'lumotlarni yuklab bo'lmadi.");
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("Fetch top ideas error:", err);
      onActionToast("Tarmoq ulanishida xatolik.");
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopIdeas();
  }, [categoryFilter, timeFilter, page]);

  const handleCategoryChange = (cat: string) => {
    setCategoryFilter(cat);
    setPage(1);
  };

  const handleTimeChange = (time: string) => {
    setTimeFilter(time);
    setPage(1);
  };

  const handleUpvote = async (ideaId: number) => {
    const storageKey = `savdo24_upvoted_${ideaId}`;
    if (localStorage.getItem(storageKey)) {
      onActionToast("Siz ushbu g'oyaga allaqachon ovoz bergansiz.");
      return;
    }
    if (votingIds.has(ideaId)) return;

    setVotingIds(prev => new Set(prev).add(ideaId));
    try {
      const res = await fetch(`/api/ideas/${ideaId}/upvote`, {
        method: 'POST',
      });
      if (res.ok) {
        localStorage.setItem(storageKey, 'true');
        onActionToast("Ovoz berildi!");
        setIdeas((prev) =>
          prev.map((idea) =>
            idea.id === ideaId ? { ...idea, upvotes: idea.upvotes + 1 } : idea
          )
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
      setVotingIds(prev => {
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
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-3xl">emoji_events</span>
            G'oyalar va Takliflar reytingi
          </h1>
          <p className="text-xs md:text-sm text-on-primary-container leading-relaxed">
            Platformadagi loyihalar rivojlanishi uchun taklif etilgan eng sara g'oyalarning umumiy reytingi.
          </p>
        </div>
        <div className="bg-secondary-container/10 border border-secondary/20 px-4 py-2 rounded-2xl flex items-center gap-2 self-start md:self-auto">
          <span className="material-symbols-outlined text-secondary text-sm">tips_and_updates</span>
          <span className="text-xs text-white font-extrabold">Jami: {totalItems} ta g'oya</span>
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
                    : 'text-on-primary-container hover:text-white'
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
              className="px-4 py-2 bg-surface-container border border-white/10 rounded-xl outline-none text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
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

        {/* Ideas Ranking List */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-secondary animate-spin">sync</span>
            <p className="text-sm text-on-primary-container font-semibold">G'oyalar yuklanmoqda...</p>
          </div>
        ) : ideas.length === 0 ? (
          <div className="py-16 text-center space-y-3 border border-dashed border-white/5 rounded-2xl bg-white/1">
            <span className="material-symbols-outlined text-5xl text-on-primary-container opacity-30">lightbulb_outline</span>
            <p className="text-sm text-white font-extrabold">Mos keluvchi g'oyalar topilmadi</p>
            <p className="text-xs text-on-primary-container">Kategoriya yoki vaqt filtrlarini o'zgartirib ko'ring.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ideas.map((idea, index) => {
              const globalIndex = (page - 1) * limit + index + 1;
              let rankBadge = `${globalIndex}`;
              let rankClass = "bg-surface-container text-on-primary-container border border-white/5";
              if (globalIndex === 1) {
                rankBadge = "🥇";
                rankClass = "bg-yellow-500/20 text-secondary font-black border border-yellow-500/30 shadow-lg shadow-yellow-500/5";
              } else if (globalIndex === 2) {
                rankBadge = "🥈";
                rankClass = "bg-slate-300/20 text-slate-300 font-bold border border-slate-300/20";
              } else if (globalIndex === 3) {
                rankBadge = "🥉";
                rankClass = "bg-amber-700/20 text-amber-500 font-bold border border-amber-700/20";
              }

              return (
                <div
                  key={idea.id}
                  className="bg-surface-container-low border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all"
                >
                  <div className="flex items-start gap-4 flex-1">
                    {/* Rank Badge */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-mono shrink-0 font-bold ${rankClass}`}>
                      {rankBadge}
                    </div>

                    {/* Idea details */}
                    <div className="space-y-2 min-w-0 flex-1">
                      <p className="text-white text-xs md:text-sm leading-relaxed font-semibold break-words">
                        {idea.content}
                      </p>
                      
                      <div className="flex items-center gap-2.5 text-xs text-on-primary-container flex-wrap">
                        <span className="font-extrabold text-secondary flex items-center gap-1 bg-secondary/10 px-2 py-0.5 rounded-lg border border-secondary/10">
                          <span className="material-symbols-outlined text-xs">person</span>
                          {idea.authorName}
                        </span>
                        <span>•</span>
                        <span className="bg-white/5 px-2 py-0.5 rounded-lg text-xs border border-white/5">
                          {formatDate(idea.createdAt, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        {idea.startup && (
                          <>
                            <span>•</span>
                            <button
                              onClick={() => handleStartupClick(idea.startupId)}
                              className="text-secondary font-extrabold hover:underline text-left flex items-center gap-1 bg-secondary/5 px-2 py-0.5 rounded-lg border border-secondary/10 transition-all focus:outline-none focus:ring-1 focus:ring-secondary"
                            >
                              <span className="material-symbols-outlined text-xs">rocket_launch</span>
                              {idea.startup.name}
                            </button>
                            <span className="text-xs uppercase bg-white/5 px-1.5 py-0.5 rounded-lg border border-white/5">
                              {categories.find(c => c.id === idea.startup?.category)?.name || idea.startup.category}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Upvote rating trigger */}
                  <button
                    onClick={() => handleUpvote(idea.id)}
                    disabled={votingIds.has(idea.id)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-white/3 hover:bg-secondary/10 hover:border-secondary/30 border border-white/5 rounded-xl px-4 py-2.5 transition-all active:scale-95 group shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
                  >
                    <span className="material-symbols-outlined text-secondary text-base group-hover:scale-110 transition-transform">
                      thumb_up
                    </span>
                    <span className="text-xs font-extrabold text-white font-mono">
                      {idea.upvotes} ta ovoz
                    </span>
                  </button>
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
              className="px-4 py-2 bg-white/3 text-white text-xs font-bold rounded-xl hover:bg-white/5 disabled:opacity-30 transition-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              <span className="material-symbols-outlined text-xs">arrow_back_ios</span>
              Oldingi
            </button>
            <span className="text-xs font-bold text-on-primary-container">
              Sahifa {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 bg-white/3 text-white text-xs font-bold rounded-xl hover:bg-white/5 disabled:opacity-30 transition-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              Keyingi
              <span className="material-symbols-outlined text-xs">arrow_forward_ios</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
