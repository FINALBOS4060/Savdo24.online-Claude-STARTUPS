import React from 'react';

interface DetailIdeasSectionProps {
  ideas: any[];
  isLoadingIdeas: boolean;
  votingIdeaIds: Set<number>;
  handleUpvoteIdea: (id: number) => void;
  handleOpenReportModal: (type: string, id: string) => void;
  newIdeaContent: string;
  setNewIdeaContent: (val: string) => void;
  newIdeaAuthorName: string;
  setNewIdeaAuthorName: (val: string) => void;
  isSubmittingIdea: boolean;
  handleSubmitIdea: (e: React.FormEvent) => void;
  isLoggedIn: boolean;
}

export const DetailIdeasSection: React.FC<DetailIdeasSectionProps> = ({
  ideas,
  isLoadingIdeas,
  votingIdeaIds,
  handleUpvoteIdea,
  handleOpenReportModal,
  newIdeaContent,
  setNewIdeaContent,
  newIdeaAuthorName,
  setNewIdeaAuthorName,
  isSubmittingIdea,
  handleSubmitIdea,
  isLoggedIn,
}) => {
  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-white font-black text-lg md:text-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f0b90b]">lightbulb</span>
            Startap uchun g'oyalar va takliflar
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
                    disabled={votingIdeaIds.has(idea.id)}
                    className="flex flex-col items-center justify-center gap-1 bg-white/4 hover:bg-[#f0b90b]/10 hover:border-[#f0b90b]/30 border border-white/5 rounded-xl px-3 py-2 transition-all active:scale-95 group shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
          Yangi g'oya qo'shish
        </h4>
        <textarea
          value={newIdeaContent}
          onChange={(e) => setNewIdeaContent(e.target.value)}
          placeholder="Startapni yaxshilash uchun o'z taklifingizni yozing (maksimal 500 belgi)..."
          maxLength={500}
          rows={3}
          className="w-full bg-[#0b1426] border border-white/10 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-[#f0b90b]/50 transition-all resize-none"
        />
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {!isLoggedIn ? (
            <input
              type="text"
              value={newIdeaAuthorName}
              onChange={(e) => setNewIdeaAuthorName(e.target.value)}
              placeholder="Ismingiz (Mehmon)"
              className="bg-[#0b1426] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#f0b90b]/50 sm:w-56"
            />
          ) : (
            <div className="text-[11px] text-on-primary-container">
              Tizimga kirgan hisobingiz nomidan yuboriladi
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmittingIdea || !newIdeaContent.trim()}
            className="px-5 py-2.5 bg-[#f0b90b] hover:bg-[#f0b90b]/90 text-black font-extrabold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            {isSubmittingIdea ? "Yuborilmoqda..." : "G'oyani yuborish"}
          </button>
        </div>
      </form>
    </div>
  );
};
