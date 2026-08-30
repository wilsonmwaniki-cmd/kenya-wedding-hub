import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Bell, Calendar, User } from 'lucide-react';
import { PublicLinkLoading, PublicLinkUnavailable } from '@/components/PublicLinkState';

interface SharedEvent {
  id: string;
  event_time: string;
  title: string;
  description: string | null;
  assigned_people: string[];
  sort_order: number;
  category?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  prep: 'bg-blue-100 text-blue-700 border-blue-200',
  ceremony: 'bg-amber-100 text-amber-700 border-amber-200',
  reception: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  transport: 'bg-purple-100 text-purple-700 border-purple-200',
  photo: 'bg-pink-100 text-pink-700 border-pink-200',
  food: 'bg-orange-100 text-orange-700 border-orange-200',
  entertainment: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

const CATEGORY_LABELS: Record<string, string> = {
  prep: 'Prep',
  ceremony: 'Ceremony',
  reception: 'Reception',
  transport: 'Transport',
  photo: 'Photo/Video',
  food: 'Food & Drinks',
  entertainment: 'Entertainment',
  other: 'Other',
};

const VENDOR_ROLE_META: Record<string, { label: string }> = {
  photographer: { label: 'Photographer' },
  videographer: { label: 'Videographer' },
  mc: { label: 'MC / Host' },
  makeup: { label: 'Makeup Artist' },
  hair: { label: 'Hair Stylist' },
  dj: { label: 'DJ' },
  florist: { label: 'Florist' },
  caterer: { label: 'Caterer' },
  decorator: { label: 'Decorator' },
  planner: { label: 'Planner' },
  transport: { label: 'Transport' },
  officiant: { label: 'Officiant' },
  other: { label: 'Team Member' },
};

interface SharedTimeline {
  id: string;
  title: string;
  timeline_date: string | null;
  assignee_name?: string;
  vendor_role?: string | null;
  events: SharedEvent[];
}

export default function TimelineShare() {
  const { token } = useParams<{ token: string }>();
  const [timeline, setTimeline] = useState<SharedTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      const { data: assigneeData } = await supabase.rpc('get_assignee_timeline', { _share_token: token });
      if (assigneeData) {
        setTimeline(assigneeData as unknown as SharedTimeline);
        setLoading(false);
        return;
      }
      const { data: fullData } = await supabase.rpc('get_shared_timeline', { _share_token: token });
      if (fullData) {
        setTimeline(fullData as unknown as SharedTimeline);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    };
    void load();
  }, [token]);

  useEffect(() => {
    if (!token || notFound) return;
    const interval = setInterval(async () => {
      const { data: assigneeData } = await supabase.rpc('get_assignee_timeline', { _share_token: token });
      if (assigneeData) {
        setTimeline(assigneeData as unknown as SharedTimeline);
        return;
      }
      const { data: fullData } = await supabase.rpc('get_shared_timeline', { _share_token: token });
      if (fullData) setTimeline(fullData as unknown as SharedTimeline);
    }, 30000);
    return () => clearInterval(interval);
  }, [token, notFound]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const nextEvent = useMemo(() => {
    if (!timeline?.events.length || !timeline.timeline_date) return null;
    const today = now.toISOString().split('T')[0];
    if (timeline.timeline_date !== today) return null;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (const event of timeline.events) {
      const [hours, minutes] = event.event_time.split(':').map(Number);
      const eventMinutes = hours * 60 + minutes;
      if (eventMinutes > currentMinutes) {
        return { ...event, minutesUntil: eventMinutes - currentMinutes };
      }
    }
    return null;
  }, [now, timeline]);

  const roleMeta = timeline?.vendor_role ? VENDOR_ROLE_META[timeline.vendor_role] : null;
  const isPersonalView = !!timeline?.assignee_name;
  const isWeddingDay = timeline?.timeline_date === now.toISOString().split('T')[0];
  if (loading) {
    return <PublicLinkLoading loadingLabel="Opening timeline…" />;
  }

  if (notFound || !timeline) {
    return <PublicLinkUnavailable title="Timeline unavailable" message="Ask the couple for a new link." />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))]">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(230,118,73,0.12),rgba(255,255,255,0.98)_40%,rgba(255,243,237,0.9))] shadow-card">
          <CardContent className="space-y-5 p-6 sm:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Wedding timeline</p>
              {isPersonalView ? (
                <div className="space-y-3">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    {timeline.assignee_name}&apos;s timeline
                  </h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="gap-1.5 rounded-full px-3 py-1 text-sm">
                      <User className="h-3.5 w-3.5" />
                      {timeline.assignee_name}
                    </Badge>
                    {roleMeta && (
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-sm">
                        {roleMeta.label}
                      </Badge>
                    )}
                  </div>
                  <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{timeline.title}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{timeline.title}</h1>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {timeline.timeline_date && (
                  <Badge variant="outline" className="gap-1.5 rounded-full border-border/70 bg-background/80 px-3 py-1 text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(timeline.timeline_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Badge>
                )}
              </div>
          </CardContent>
        </Card>

        {nextEvent && (
          <div className="mt-6 rounded-3xl border border-primary/20 bg-primary/8 shadow-card">
            <div className="px-4 py-3 sm:px-6">
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Up next: {nextEvent.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {nextEvent.minutesUntil <= 60
                      ? `In ${nextEvent.minutesUntil} minute${nextEvent.minutesUntil !== 1 ? 's' : ''}`
                      : `In ${Math.floor(nextEvent.minutesUntil / 60)}h ${nextEvent.minutesUntil % 60}m`}{' '}
                    · {formatTime(nextEvent.event_time)}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        <div className="mt-6">
          {timeline.events.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No events yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-card">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-foreground">Schedule</h2>
                  </div>
                  {isWeddingDay && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/10 px-3 py-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      Current
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/10 px-3 py-1">
                      <span className="h-2.5 w-2.5 rounded-full border border-primary bg-background" />
                      Upcoming
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/10 px-3 py-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                      Past
                    </span>
                  </div>}
                </div>

                <div className="relative ml-3 space-y-1 border-l-2 border-primary/20 pl-5 sm:ml-4 sm:pl-6">
                  {timeline.events.map((event, index) => {
                    let status: 'past' | 'current' | 'upcoming' = 'upcoming';

                    if (isWeddingDay) {
                      const currentMinutes = now.getHours() * 60 + now.getMinutes();
                      const [hours, minutes] = event.event_time.split(':').map(Number);
                      const eventMinutes = hours * 60 + minutes;
                      const nextEventMinutes =
                        index < timeline.events.length - 1
                          ? (() => {
                              const [nextHours, nextMinutes] = timeline.events[index + 1].event_time.split(':').map(Number);
                              return nextHours * 60 + nextMinutes;
                            })()
                          : eventMinutes + 60;

                      if (currentMinutes >= eventMinutes && currentMinutes < nextEventMinutes) status = 'current';
                      else if (currentMinutes >= nextEventMinutes) status = 'past';
                    }

                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.06 }}
                        className="relative"
                      >
                        <div
                          className={`absolute -left-[27px] top-4 h-3.5 w-3.5 rounded-full border-2 transition-colors sm:-left-[31px] ${
                            status === 'current'
                              ? 'border-primary bg-primary animate-pulse'
                              : status === 'past'
                                ? 'border-muted-foreground/40 bg-muted'
                                : 'border-primary bg-background'
                          }`}
                        />

                        <Card className={`transition-all shadow-sm ${status === 'current' ? 'ring-2 ring-primary/30 shadow-md' : status === 'past' ? 'opacity-60' : ''}`}>
                          <CardContent className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                            <div className="min-w-[70px] shrink-0 sm:min-w-[80px]">
                              <p
                                className={`font-display text-base font-bold sm:text-lg ${
                                  status === 'past' ? 'text-muted-foreground' : 'text-primary'
                                }`}
                              >
                                {formatTime(event.event_time)}
                              </p>
                              {status === 'current' && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Now</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="font-semibold text-card-foreground">{event.title}</p>
                                {event.category && CATEGORY_COLORS[event.category] && (
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[event.category]}`}>
                                    {CATEGORY_LABELS[event.category]}
                                  </span>
                                )}
                              </div>
                              {event.description && <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>}
                              {event.assigned_people.length > 0 && !isPersonalView && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {event.assigned_people.map((person) => (
                                    <Badge key={person} variant="outline" className="text-xs font-normal">
                                      {person}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <p className="mt-10 text-center text-xs text-muted-foreground">Powered by Zania</p>
        </div>
      </div>
    </div>
  );
}
