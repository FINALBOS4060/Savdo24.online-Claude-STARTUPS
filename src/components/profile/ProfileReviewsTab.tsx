import React from 'react';
import { Star, MessageSquareText } from 'lucide-react';

interface ProfileReviewsTabProps {
  reviewsReceivedData: {
    averageRating: number;
    totalReviews: number;
    reviews: any[];
  };
  reviewsGiven: any[];
}

export const ProfileReviewsTab: React.FC<ProfileReviewsTabProps> = ({
  reviewsReceivedData,
  reviewsGiven,
}) => {
  return (
    <section className="space-y-8">
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-on-primary-container flex items-center gap-2">
            <Star className="w-6 h-6 text-secondary-container" />
            Menga yozilgan sharhlar
          </h3>
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            <span className="text-sm font-bold text-on-primary-container">O'rtacha reyting:</span>
            <span className="text-lg font-extrabold text-secondary">{reviewsReceivedData.averageRating.toFixed(1)}</span>
            <div className="flex text-secondary">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={`w-4 h-4 ${star <= Math.round(reviewsReceivedData.averageRating) ? 'fill-current' : ''}`} />
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
              <div key={review.id} className="bg-background border border-outline-variant/10 rounded-xl p-5">
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
                      <p className="text-sm font-bold text-on-primary-container">{review.buyer?.name}</p>
                      <p className="text-xs text-on-primary-container">{new Date(review.createdAt).toLocaleDateString()} • {review.startup?.name}</p>
                    </div>
                  </div>
                  <div className="flex text-secondary">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-4 h-4 ${star <= review.rating ? 'fill-current' : ''}`} />
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
        <h3 className="text-lg font-bold text-on-primary-container mb-6 flex items-center gap-2">
          <MessageSquareText className="w-6 h-6 text-secondary-container" />
          Men yozgan sharhlar
        </h3>

        {reviewsGiven.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-outline-variant/20 rounded-2xl">
            <p className="text-on-primary-container font-medium">Siz hali sharh yozmagansiz</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviewsGiven.map((review: any) => (
              <div key={review.id} className="bg-background border border-outline-variant/10 rounded-xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-bold text-on-primary-container">{review.startup?.name}</p>
                    <p className="text-xs text-on-primary-container">{new Date(review.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex text-secondary">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-4 h-4 ${star <= review.rating ? 'fill-current' : ''}`} />
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
  );
};
