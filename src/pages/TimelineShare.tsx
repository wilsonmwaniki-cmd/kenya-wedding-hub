import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Bell, Calendar, CheckCircle2, Clock, Heart, Sparkles, TimerReset, User } from 'lucide-react';

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

const VENDOR_ROLE_META: Record<string, { label: string; icon: string }> = {
  photographer: { label: 'Photographer', icon: '📸' },
  videographer: { label: 'Videographer', icon: '🎬' },
  mc: { label: 'MC / Host', icon: '🎤' },
  makeup: { label: 'Makeup Artist', icon: '💄' },
  hair: { label: 'Hair Stylist', icon: '💇' },
  dj: { label: 'DJ', icon: '🎵' },
  florist: { label: 'Florist', icon: '💐' },
  caterer: { label: 'Caterer', icon: '🍽️' },
  decorator: { label: 'Decorator', icon: '✨' },
  planner: { label: 'Planner', icon: '📋' },
  transport: { label: 'Transport', icon: '🚗' },
  officiant: { label: 'Officiant', icon: '💍' },
  other: { label: 'Team Member', icon: '👤' },
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
  const completedCount = useMemo(() => {
    if (!timeline?.events.length || !timeline.timeline_date || timeline.timeline_date !== now.toISOString().split('T')[0]) return 0;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return timeline.events.filter((event) => {
      const [hours, minutes] = event.event_time.split(':').map(Number);
      return hours * 60 + minutes < currentMinutes;
    }).length;
  }, [now, timeline]);
  const categoryCount = useMemo(
    () => new Set(timeline?.events.map((event) => event.category).filter(Boolean)).size,
    [timeline],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))] px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card">
          <Clock className="h-4 w-4 animate-pulse text-primary" />
          Opening timeline...
        </div>
      </div>
    );
  }

  if (notFound || !timeline) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))] px-6">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
          <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h1 className="font-display text-2xl font-semibold text-foreground">Timeline not found</h1>
          <p className="mt-2 text-muted-foreground">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))]">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(230,118,73,0.12),rgba(255,255,255,0.98)_40%,rgba(255,243,237,0.9))] shadow-card">
          <CardContent className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,1.55fr)_280px]">
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" fill="currentColor" />
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Zania Timeline Share</span>
              </div>

              {isPersonalView ? (
                <div className="space-y-3">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    {roleMeta ? `${roleMeta.icon} My Timeline` : 'My Timeline'}
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
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{timeline.title}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{timeline.title}</h1>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    A live wedding-day schedule that updates in real time so everyone can stay aligned on what happens next.
                  </p>
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
                {isPersonalView && (
                  <Badge variant="outline" className="gap-1.5 rounded-full border-border/70 bg-background/80 px-3 py-1 text-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    {timeline.events.length} assigned event{timeline.events.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.2rem] border border-border/70 bg-background/90 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Events</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{timeline.events.length}</p>
                </div>
                <div className="rounded-[1.2rem] border border-border/70 bg-background/90 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Completed</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{completedCount}</p>
                </div>
                <div className="rounded-[1.2rem] border border-border/70 bg-background/90 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Categories</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{categoryCount}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 p-6 shadow-sm">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Next Best Move</p>
                <h2 className="text-2xl font-semibold text-foreground">
                  {nextEvent ? 'Stay ready for the next handoff' : 'Use this page as your live run sheet'}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {nextEvent
                    ? `${nextEvent.title} is the next key moment. Keep this page open so your schedule stays current without refreshing.`
                    : 'Bookmark this page or keep it open during the wedding day to track the flow as timing shifts.'}
                </p>
              </div>
              <div className="mt-6 space-y-3">
                {nextEvent ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                    <p className="text-sm font-semibold text-foreground">{nextEvent.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatTime(nextEvent.event_time)} ·{' '}
                      {nextEvent.minutesUntil <= 60
                        ? `in ${nextEvent.minutesUntil} minute${nextEvent.minutesUntil !== 1 ? 's' : ''}`
                        : `in ${Math.floor(nextEvent.minutesUntil / 60)}h ${nextEvent.minutesUntil % 60}m`}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                    No upcoming event countdown is active right now.
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">Live updates</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">This shared timeline refreshes automatically every 30 seconds.</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    <div className="flex items-center gap-2">
                      <TimerReset className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">Role-aware view</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isPersonalView
                        ? 'You are only seeing the moments assigned to you.'
                        : 'Everyone viewing this page sees the shared wedding-day schedule.'}
                    </p>
                  </div>
                </div>
              </div>
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
                <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p>No events scheduled yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-card">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-foreground">Wedding-day flow</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Track every key moment in order, with assignments and timing in one calm place.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                  </div>
                </div>

                <div className="relative ml-3 space-y-1 border-l-2 border-primary/20 pl-5 sm:ml-4 sm:pl-6">
                  {timeline.events.map((event, index) => {
                    const today = now.toISOString().split('T')[0];
                    const isWeddingDay = timeline.timeline_date === today;
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

          <p className="mt-10 text-center text-xs text-muted-foreground">Powered by Zania · This timeline updates in real time</p>
        </div>
      </div>
    </div>
  );
}
