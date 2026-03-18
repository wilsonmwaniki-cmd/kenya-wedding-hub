import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Clock, Calendar, Heart, User, MapPin, Bell } from 'lucide-react';

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
  prep: 'Prep', ceremony: 'Ceremony', reception: 'Reception', transport: 'Transport',
  photo: 'Photo/Video', food: 'Food & Drinks', entertainment: 'Entertainment', other: 'Other',
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
    load();
  }, [token]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!token || notFound) return;
    const interval = setInterval(async () => {
      const { data: assigneeData } = await supabase.rpc('get_assignee_timeline', { _share_token: token });
      if (assigneeData) { setTimeline(assigneeData as unknown as SharedTimeline); return; }
      const { data: fullData } = await supabase.rpc('get_shared_timeline', { _share_token: token });
      if (fullData) setTimeline(fullData as unknown as SharedTimeline);
    }, 30000);
    return () => clearInterval(interval);
  }, [token, notFound]);

  // Tick clock every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  // Find next upcoming event
  const nextEvent = useMemo(() => {
    if (!timeline?.events.length || !timeline.timeline_date) return null;
    const todayStr = now.toISOString().split('T')[0];
    if (timeline.timeline_date !== todayStr) return null; // only show countdown on the day

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (const ev of timeline.events) {
      const [h, m] = ev.event_time.split(':').map(Number);
      const evMin = h * 60 + m;
      if (evMin > currentMinutes) {
        return { ...ev, minutesUntil: evMin - currentMinutes };
      }
    }
    return null;
  }, [timeline, now]);

  const roleMeta = timeline?.vendor_role ? VENDOR_ROLE_META[timeline.vendor_role] : null;
  const isPersonalView = !!timeline?.assignee_name;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading timeline…</div>
      </div>
    );
  }

  if (notFound || !timeline) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground">Timeline not found</h1>
          <p className="text-muted-foreground mt-1">This link may have expired or been removed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-primary" fill="currentColor" />
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Zania</span>
          </div>

          {/* Personal role-aware heading */}
          {isPersonalView ? (
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                {roleMeta ? `${roleMeta.icon} My Timeline` : 'My Timeline'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge className="gap-1.5 text-sm px-3 py-1">
                  <User className="h-3.5 w-3.5" />
                  {timeline.assignee_name}
                  {roleMeta && <span className="text-muted-foreground">· {roleMeta.label}</span>}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{timeline.title}</p>
            </div>
          ) : (
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">{timeline.title}</h1>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-2">
            {timeline.timeline_date && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(timeline.timeline_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>

          {isPersonalView && (
            <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
              Showing only events assigned to you · {timeline.events.length} event{timeline.events.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </header>

      {/* Next event countdown banner */}
      {nextEvent && (
        <div className="bg-primary/10 border-b border-primary/20">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Up next: {nextEvent.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {nextEvent.minutesUntil <= 60
                    ? `In ${nextEvent.minutesUntil} minute${nextEvent.minutesUntil !== 1 ? 's' : ''}`
                    : `In ${Math.floor(nextEvent.minutesUntil / 60)}h ${nextEvent.minutesUntil % 60}m`
                  } · {formatTime(nextEvent.event_time)}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {timeline.events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p>No events scheduled yet</p>
          </div>
        ) : (
          <div className="relative ml-3 sm:ml-4 border-l-2 border-primary/20 pl-5 sm:pl-6 space-y-1">
            {timeline.events.map((ev, i) => {
              // Determine if this event is "current" (on wedding day)
              const todayStr = now.toISOString().split('T')[0];
              const isWeddingDay = timeline.timeline_date === todayStr;
              let status: 'past' | 'current' | 'upcoming' = 'upcoming';
              if (isWeddingDay) {
                const currentMin = now.getHours() * 60 + now.getMinutes();
                const [h, m] = ev.event_time.split(':').map(Number);
                const evMin = h * 60 + m;
                const nextEvMin = i < timeline.events.length - 1
                  ? (() => { const [nh, nm] = timeline.events[i + 1].event_time.split(':').map(Number); return nh * 60 + nm; })()
                  : evMin + 60;
                if (currentMin >= evMin && currentMin < nextEvMin) status = 'current';
                else if (currentMin >= nextEvMin) status = 'past';
              }

              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="relative"
                >
                  {/* Dot */}
                  <div className={`absolute -left-[27px] sm:-left-[31px] top-4 h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                    status === 'current'
                      ? 'border-primary bg-primary animate-pulse'
                      : status === 'past'
                        ? 'border-muted-foreground/40 bg-muted'
                        : 'border-primary bg-background'
                  }`} />

                  <Card className={`shadow-sm transition-all ${
                    status === 'current' ? 'ring-2 ring-primary/30 shadow-md' : status === 'past' ? 'opacity-60' : ''
                  }`}>
                    <CardContent className="flex items-start gap-3 sm:gap-4 py-4 px-4 sm:px-5">
                      <div className="shrink-0 min-w-[70px] sm:min-w-[80px]">
                        <p className={`text-base sm:text-lg font-bold font-display ${
                          status === 'current' ? 'text-primary' : status === 'past' ? 'text-muted-foreground' : 'text-primary'
                        }`}>{formatTime(ev.event_time)}</p>
                        {status === 'current' && (
                          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Now</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-card-foreground">{ev.title}</p>
                          {ev.category && CATEGORY_COLORS[ev.category] && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_COLORS[ev.category]}`}>
                              {CATEGORY_LABELS[ev.category]}
                            </span>
                          )}
                        </div>
                        {ev.description && <p className="text-sm text-muted-foreground mt-0.5">{ev.description}</p>}
                        {ev.assigned_people.length > 0 && !isPersonalView && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {ev.assigned_people.map(p => (
                              <Badge key={p} variant="outline" className="text-xs font-normal">{p}</Badge>
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
        )}

        <p className="text-center text-xs text-muted-foreground mt-10">
          Powered by Zania · This timeline updates in real time
        </p>
      </div>
    </div>
  );
}
