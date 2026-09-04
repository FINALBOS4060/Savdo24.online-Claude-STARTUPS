import React from 'react';
import { X, Star, Gavel, Flag } from 'lucide-react';

interface DetailModalsProps {
  isReviewModalOpen: boolean;
  setIsReviewModalOpen: (val: boolean) => void;
  reviewRating: number;
  setReviewRating: (val: number) => void;
  reviewComment: string;
  setReviewComment: (val: string) => void;
  isSubmittingReview: boolean;
  handleReviewSubmit: (e: React.FormEvent) => void;

  isDisputeModalOpen: boolean;
  setIsDisputeModalOpen: (val: boolean) => void;
  disputeReason: string;
  setDisputeReason: (val: string) => void;
  disputeDescription: string;
  setDisputeDescription: (val: string) => void;
  isSubmittingDispute: boolean;
  handleDisputeSubmit: (e: React.FormEvent) => void;

  reportModalOpen: boolean;
  setReportModalOpen: (val: boolean) => void;
  reportReason: string;
  setReportReason: (val: string) => void;
  reportDescription: string;
  setReportDescription: (val: string) => void;
  isSubmittingReport: boolean;
  handleReportSubmit: (e: React.FormEvent) => void;
}

export const DetailModals: React.FC<DetailModalsProps> = ({
  isReviewModalOpen,
  setIsReviewModalOpen,
  reviewRating,
  setReviewRating,
  reviewComment,
  setReviewComment,
  isSubmittingReview,
  handleReviewSubmit,

  isDisputeModalOpen,
  setIsDisputeModalOpen,
  disputeReason,
  setDisputeReason,
  disputeDescription,
  setDisputeDescription,
  isSubmittingDispute,
  handleDisputeSubmit,

  reportModalOpen,
  setReportModalOpen,
  reportReason,
  setReportReason,
  reportDescription,
  setReportDescription,
  isSubmittingReport,
  handleReportSubmit,
}) => {
  return (
    <>
      {/* Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsReviewModalOpen(false)}
              className="absolute top-4 right-4 text-on-primary-container hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface rounded-full p-1 cursor-pointer flex items-center justify-center"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-on-primary-container font-black text-lg">Loyiha va Sotuvchi haqida sharh</h3>
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
                      className="text-2xl transition-all active:scale-90 hover:scale-110 cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary rounded-full"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= reviewRating ? "text-secondary fill-secondary" : "text-gray-600"
                        }`}
                      />
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
                  maxLength={1000}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-on-primary-container text-xs placeholder-on-primary-container/60 transition-all focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-on-primary-container font-bold text-xs rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview || !reviewComment.trim()}
                  className="flex-1 py-3 bg-secondary hover:brightness-110 disabled:opacity-40 text-on-secondary font-black text-xs rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface cursor-pointer"
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
          <div className="w-full max-w-md bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsDisputeModalOpen(false)}
              className="absolute top-4 right-4 text-on-primary-container hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface rounded-full p-1 cursor-pointer flex items-center justify-center"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-red-400 font-black text-lg flex items-center justify-center gap-1.5">
                <Gavel className="w-5 h-5 text-red-400" />
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
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-on-primary-container text-xs placeholder-on-primary-container/60 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-surface"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-on-primary-container font-extrabold uppercase">Batafsil tavsif</label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Muammo haqida barcha tafsilotlarni qoldiring. Loyiha topshirilmadi yoki va'da qilingan texnik standartga mos kelmasligi sabablarini tushuntirib bering..."
                  rows={4}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-on-primary-container text-xs placeholder-on-primary-container/60 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-surface"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisputeModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-on-primary-container font-bold text-xs rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute || !disputeReason.trim() || !disputeDescription.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-surface cursor-pointer"
                >
                  {isSubmittingDispute ? "Yuborilmoqda..." : "Nizo ochish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setReportModalOpen(false)}
              className="absolute top-4 right-4 text-on-primary-container hover:text-on-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface rounded-full p-1 cursor-pointer flex items-center justify-center"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-red-400 font-black text-lg flex items-center justify-center gap-1.5">
                <Flag className="w-5 h-5 text-red-500" />
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
                  className="w-full p-3 bg-surface-container-low border border-white/10 rounded-xl text-on-primary-container text-xs transition-all font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-surface"
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
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-on-primary-container text-xs placeholder-on-primary-container/60 transition-all font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-surface"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-on-primary-container font-bold text-xs rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-surface cursor-pointer"
                >
                  {isSubmittingReport ? "Yuborilmoqda..." : "Shikoyat yuborish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
