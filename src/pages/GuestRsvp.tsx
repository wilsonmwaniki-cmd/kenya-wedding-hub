import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MapPin, Calendar, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="font-display text-xl font-semibold text-foreground">{error || 'Link not found'}</h1>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alreadyResponded = !responded && data.rsvp_status !== 'pending';
  const isConfirmed = data.rsvp_status === 'confirmed';

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="overflow-hidden shadow-warm">
          {/* Header */}
          <div className="bg-gradient-hero px-6 py-10 text-center text-primary-foreground">
            <Heart className="h-8 w-8 mx-auto mb-3 opacity-80" />
            {data.couple_name && (
              <h1 className="font-display text-2xl font-bold mb-1">{data.couple_name}</h1>
            )}
            <p className="text-sm opacity-90">invite you to celebrate their wedding</p>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Guest greeting */}
            <div className="text-center">
              <p className="text-muted-foreground text-sm">Dear</p>
              <p className="font-display text-xl font-semibold text-foreground">{data.guest_name}</p>
            </div>

            {/* Wedding details */}
            <div className="space-y-3">
              {data.wedding_date && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-foreground">
                    {new Date(data.wedding_date).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {data.wedding_location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-foreground">{data.wedding_location}</span>
                </div>
              )}
            </div>

            {/* Response section */}
            <AnimatePresence mode="wait">
              {(responded || alreadyResponded) ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6 space-y-3"
                >
                  {isConfirmed ? (
                    <>
                      <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
                      <p className="font-display text-lg font-semibold text-foreground">We'll see you there!</p>
                      <p className="text-sm text-muted-foreground">Your attendance has been confirmed. Thank you!</p>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="font-display text-lg font-semibold text-foreground">We'll miss you!</p>
                      <p className="text-sm text-muted-foreground">Thank you for letting us know.</p>
                    </>
                  )}
                  {alreadyResponded && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-3">Changed your mind?</p>
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="outline" onClick={() => respond('confirmed')} disabled={submitting}>
                          I'll attend
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => respond('declined')} disabled={submitting}>
                          Can't make it
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
                  className="space-y-3"
                >
                  <p className="text-center text-sm text-muted-foreground">Will you be joining us?</p>
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => respond('confirmed')}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Joyfully Accept
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => respond('declined')}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Regretfully Decline
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4 opacity-60">
          Powered by PlanIt
        </p>
      </motion.div>
    </div>
  );
}
