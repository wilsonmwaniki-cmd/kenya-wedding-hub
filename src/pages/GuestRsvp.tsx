import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicLinkLoading, PublicLinkUnavailable } from '@/components/PublicLinkState';

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
      const res = result as (RsvpData & { error?: string }) | null;
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
    const res = result as { error?: string } | null;
    if (error || res?.error) {
      setError('Something went wrong. Please try again.');
    } else {
      setData(prev => prev ? { ...prev, rsvp_status: status } : prev);
      setResponded(true);
    }
    setSubmitting(false);
  };

  if (loading) {
    return <PublicLinkLoading loadingLabel="Opening invitation…" />;
  }

  if (error || !data) {
    return <PublicLinkUnavailable title="RSVP link unavailable" message="Ask the couple for a new link." />;
  }

  const alreadyResponded = !responded && data.rsvp_status !== 'pending';
  const isConfirmed = data.rsvp_status === 'confirmed';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))] p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl">
        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(230,118,73,0.12),rgba(255,255,255,0.98)_38%,rgba(255,243,237,0.9))] shadow-card">
          <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="space-y-3 text-center">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Wedding RSVP</p>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {data.couple_name || 'Wedding invitation'}
                </h1>
                <p className="text-base text-muted-foreground">
                  Hi {data.guest_name}, will you attend?
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {data.wedding_date && (
                  <div className="rounded-[1.2rem] border border-border/70 bg-background/90 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Date</p>
                    <div className="mt-2">
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
                    <div className="mt-2">
                      <span className="text-sm font-medium text-foreground">{data.wedding_location}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-border/70 bg-white/90 p-6 shadow-sm">
                  <AnimatePresence mode="wait">
                    {responded || alreadyResponded ? (
                      <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        role="status"
                        className="space-y-3 text-center"
                      >
                        {isConfirmed ? (
                          <>
                            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
                            <p className="font-display text-lg font-semibold text-foreground">Response saved</p>
                            <p className="text-sm text-muted-foreground">You’ll attend.</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                            <p className="font-display text-lg font-semibold text-foreground">Response saved</p>
                            <p className="text-sm text-muted-foreground">You can’t attend.</p>
                          </>
                        )}
                        {(responded || alreadyResponded) && (
                          <div className="pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground mb-3">Change response</p>
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                              <Button size="sm" variant="outline" onClick={() => respond('confirmed')} disabled={submitting}>
                                Yes, I’ll attend
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => respond('declined')} disabled={submitting}>
                                No, I can’t attend
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
                        className="space-y-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button className="flex-1 gap-2" onClick={() => respond('confirmed')} disabled={submitting}>
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Yes, I’ll attend
                          </Button>
                          <Button variant="outline" className="flex-1 gap-2" onClick={() => respond('declined')} disabled={submitting}>
                            No, I can’t attend
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
