import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MapPin, Calendar, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RsvpData {
  guest_name: string;
  rsvp_status: string;
  couple_name: string | null;
  wedding_date: string | null;
  wedding_location: string | null;
}

export default function GuestRsvp() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RsvpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responded, setResponded] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: result, error } = await supabase.rpc('public_rsvp_lookup', { _token: token });
      const res = result as any;
      if (error || res?.error) {
        setError('This RSVP link is invalid or has expired.');
      } else {
        setData(res as RsvpData);
      }
      setLoading(false);
    })();
  }, [token]);

  const respond = async (status: 'confirmed' | 'declined') => {
    if (!token) return;
    setSubmitting(true);
    const { data: result, error } = await supabase.rpc('public_rsvp_respond', { _token: token, _status: status });
    const res = result as any;
    if (error || res?.error) {
      setError('Something went wrong. Please try again.');
    } else {
      setData(prev => prev ? { ...prev, rsvp_status: status } : prev);
      setResponded(true);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))] flex items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Opening RSVP invitation...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center shadow-card">
          <CardContent className="py-12">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="font-display text-xl font-semibold text-foreground">{error || 'Link not found'}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please contact the couple if you think this invitation should still be active.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alreadyResponded = !responded && data.rsvp_status !== 'pending';
  const isConfirmed = data.rsvp_status === 'confirmed';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))] p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(230,118,73,0.12),rgba(255,255,255,0.98)_38%,rgba(255,243,237,0.9))] shadow-card">
          <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_320px]">
            <div className="space-y-6">
              <div className="space-y-3 text-center lg:text-left">
                <div className="flex items-center justify-center gap-2 lg:justify-start">
                  <Heart className="h-4 w-4 text-primary" fill="currentColor" />
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Zania RSVP</span>
                </div>
                {data.couple_name && (
                  <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{data.couple_name}</h1>
                )}
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                  {data.guest_name}, you’re warmly invited to celebrate this wedding. Please let the couple know whether you’ll be joining them.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {data.wedding_date && (
                  <div className="rounded-[1.2rem] border border-border/70 bg-background/90 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Date</p>
                    <div className="mt-2 flex items-start gap-2">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        {new Date(data.wedding_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                )}
                {data.wedding_location && (
                  <div className="rounded-[1.2rem] border border-border/70 bg-background/90 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Location</p>
                    <div className="mt-2 flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm font-medium text-foreground">{data.wedding_location}</span>
                    </div>
                  </div>
                )}
              </div>

              <Card className="border-border/70 bg-white/90 shadow-sm">
                <CardContent className="p-6">
                  <div className="text-center lg:text-left">
                    <p className="text-sm text-muted-foreground">Invitation for</p>
                    <p className="mt-1 font-display text-2xl font-semibold text-foreground">{data.guest_name}</p>
                  </div>

                  <AnimatePresence mode="wait">
                    {responded || alreadyResponded ? (
                      <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="pt-6 text-center space-y-3"
                      >
                        {isConfirmed ? (
                          <>
                            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
                            <p className="font-display text-lg font-semibold text-foreground">We’ll see you there!</p>
                            <p className="text-sm text-muted-foreground">Your attendance has been confirmed. Thank you for responding.</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                            <p className="font-display text-lg font-semibold text-foreground">We’ll miss you!</p>
                            <p className="text-sm text-muted-foreground">Thank you for letting the couple know.</p>
                          </>
                        )}
                        {alreadyResponded && (
                          <div className="pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground mb-3">Changed your mind?</p>
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                              <Button size="sm" variant="outline" onClick={() => respond('confirmed')} disabled={submitting}>
                                I’ll attend
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => respond('declined')} disabled={submitting}>
                                Can’t make it
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="buttons"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4 pt-6"
                      >
                        <p className="text-center text-sm text-muted-foreground">Will you be joining the celebration?</p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button className="flex-1 gap-2" onClick={() => respond('confirmed')} disabled={submitting}>
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Joyfully Accept
                          </Button>
                          <Button variant="outline" className="flex-1 gap-2" onClick={() => respond('declined')} disabled={submitting}>
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            Regretfully Decline
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 p-6 shadow-sm">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Next Best Move</p>
                <h2 className="text-2xl font-semibold text-foreground">
                  {alreadyResponded || responded ? 'Your response is saved' : 'Send your RSVP now'}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {alreadyResponded || responded
                    ? 'You can still update your answer from this page if your plans change before the wedding.'
                    : 'A quick response helps the couple plan seating, catering, and the final guest count with confidence.'}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Guest-friendly</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    This page is designed to keep your RSVP simple, clear, and easy to revisit if plans change.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Response status</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground capitalize">
                    Current RSVP: {data.rsvp_status === 'pending' ? 'Awaiting your response' : data.rsvp_status}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground opacity-70">
          Powered by Zania
        </p>
      </motion.div>
    </div>
  );
}
