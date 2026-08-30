import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Star } from 'lucide-react';

import BrandWordmark from '@/components/BrandWordmark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  getPublicReviewInvite,
  submitGuestProfessionalReview,
  type PublicReviewInvite,
} from '@/lib/professionalReviews';

export default function GuestReview() {
  const { token = '' } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<PublicReviewInvite | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadInvite = async () => {
      try {
        const result = await getPublicReviewInvite(token);
        if (!active) return;
        setInvite(result);
        setReviewerName(result.coupleName);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'This review invitation is invalid or has expired.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadInvite();
    return () => { active = false; };
  }, [token]);

  const submitReview = async () => {
    if (!invite || !rating || !reviewerName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitGuestProfessionalReview({ token, reviewerName, rating, reviewText });
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(212,187,125,0.18),transparent_30%),linear-gradient(180deg,#fbf7f1_0%,#f5ede2_100%)]">
      <header className="border-b border-border/70 bg-card/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center px-5 py-4">
          <BrandWordmark size="sm" />
          <span className="ml-auto text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Verified review</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
        {loading ? (
          <div role="status" className="flex min-h-72 items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Opening review…
          </div>
        ) : submitted ? (
          <Card className="border-primary/20 text-center shadow-card">
            <CardContent className="space-y-4 px-6 py-12">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <h1 className="font-display text-3xl font-semibold">Thank you for your review</h1>
              <p className="text-sm text-muted-foreground">Your rating is now part of {invite?.professionalName}’s Zania listing.</p>
              <Button asChild variant="outline"><Link to="/">Visit Zania</Link></Button>
            </CardContent>
          </Card>
        ) : !invite ? (
          <Card className="shadow-card">
            <CardContent className="space-y-4 px-6 py-12 text-center">
              <h1 className="font-display text-2xl font-semibold">Review link unavailable</h1>
              <p className="text-sm text-muted-foreground">{error || 'This invitation may have expired or already been used.'}</p>
              <Button asChild variant="outline"><Link to="/">Return to Zania</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardHeader className="space-y-3 text-center">
              <CardTitle className="font-display text-3xl">Review {invite.professionalName}</CardTitle>
              <CardDescription>Rate your experience with this {invite.professionalType}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground">Your overall rating</legend>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} star${value === 1 ? '' : 's'}`}
                      aria-pressed={rating === value}
                      onClick={() => setRating(value)}
                      className="rounded-md p-1.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Star className={`h-9 w-9 ${value <= rating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                    </button>
                  ))}
                </div>
                {rating ? <p className="text-center text-xs text-muted-foreground">{rating} out of 5 stars</p> : null}
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="reviewer-name">Your name</Label>
                <Input
                  id="reviewer-name"
                  value={reviewerName}
                  onChange={(event) => setReviewerName(event.target.value)}
                  maxLength={120}
                  required
                />
                <p className="text-xs text-muted-foreground">This name will appear publicly with your review.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-text">Your review (optional)</Label>
                <Textarea
                  id="review-text"
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  placeholder="What should another couple know?"
                  maxLength={2000}
                  rows={6}
                />
                {reviewText.length > 0 && <p className="text-right text-xs text-muted-foreground">{reviewText.length}/2000</p>}
              </div>

              {error ? <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}

              <Button className="w-full gap-2" onClick={() => void submitReview()} disabled={!rating || !reviewerName.trim() || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                Publish review
              </Button>

            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
