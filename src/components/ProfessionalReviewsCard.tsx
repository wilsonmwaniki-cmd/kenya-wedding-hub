import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, MessageCircle, Star } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listPublishedProfessionalReviews,
  summarizeProfessionalReviews,
  type ProfessionalReview,
  type ProfessionalType,
} from '@/lib/professionalReviews';

function RatingStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const iconClass = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} className={`${iconClass} ${value <= rating ? 'fill-accent text-accent' : 'text-muted-foreground/25'}`} />
      ))}
    </div>
  );
}

export default function ProfessionalReviewsCard({
  professionalType,
  professionalId,
}: {
  professionalType: ProfessionalType;
  professionalId: string;
}) {
  const [reviews, setReviews] = useState<ProfessionalReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listPublishedProfessionalReviews(professionalType, professionalId)
      .then((result) => { if (active) setReviews(result); })
      .catch((error) => console.error('Could not load professional reviews:', error))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [professionalId, professionalType]);

  const summary = summarizeProfessionalReviews(reviews);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4 font-display text-xl">
          <span>Couple reviews</span>
          {summary.average != null ? (
            <span className="flex items-center gap-2 font-sans text-base">
              <Star className="h-5 w-5 fill-accent text-accent" />
              {summary.average.toFixed(1)}
              <span className="font-normal text-muted-foreground">({summary.count})</span>
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : reviews.length === 0 ? (
          <div className="flex gap-3 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>No verified couple reviews yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reviews.map((review) => (
              <article key={review.id} className="space-y-2 py-5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{review.reviewer_name}</p>
                    <p className="text-xs text-muted-foreground">Verified couple · {format(new Date(review.created_at), 'd MMM yyyy')}</p>
                  </div>
                  <RatingStars rating={review.rating} />
                </div>
                {review.review_text ? <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{review.review_text}</p> : null}
                {review.professional_reply ? (
                  <div className="ml-3 rounded-lg border-l-2 border-primary/35 bg-muted/40 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Response</p>
                    <p className="mt-1 text-sm text-muted-foreground">{review.professional_reply}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
