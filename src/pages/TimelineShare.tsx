import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Clock, Calendar, Heart, User } from 'lucide-react';

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

interface SharedTimeline {
  id: string;
  title: string;
  timeline_date: string | null;
  assignee_name?: string;
  events: SharedEvent[];
}

export default function TimelineShare() {
  const { token } = useParams<{ token: string }>();
  const [timeline, setTimeline] = useState<SharedTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      // Try assignee link first, then full timeline link
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

  // Auto-refresh every 30s for real-time updates
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

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

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
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" />
            <span className="text-sm font-medium text-muted-foreground">WeddingPlan Kenya</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">{timeline.title}</h1>
          <div className="flex items-center gap-4 mt-2">
            {timeline.timeline_date && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(timeline.timeline_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
            {timeline.assignee_name && (
              <Badge className="gap-1">
                <User className="h-3 w-3" /> {timeline.assignee_name}
              </Badge>
            )}
          </div>
          {timeline.assignee_name && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing only events assigned to you
            </p>
          )}
        </div>
      </header>

      {/* Timeline */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        {timeline.events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p>No events scheduled yet</p>
          </div>
        ) : (
          <div className="relative ml-4 border-l-2 border-primary/20 pl-6 space-y-1">
            {timeline.events.map((ev, i) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="relative"
              >
                <div className="absolute -left-[31px] top-4 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background" />

                <Card className="shadow-sm">
                  <CardContent className="flex items-start gap-4 py-4 px-5">
                    <div className="shrink-0 min-w-[80px]">
                      <p className="text-lg font-bold text-primary font-display">{formatTime(ev.event_time)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-card-foreground">{ev.title}</p>
                        {ev.category && CATEGORY_COLORS[ev.category] && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_COLORS[ev.category]}`}>
                            {CATEGORY_LABELS[ev.category]}
                          </span>
                        )}
                      </div>
                      {ev.description && <p className="text-sm text-muted-foreground mt-0.5">{ev.description}</p>}
                      {ev.assigned_people.length > 0 && !timeline.assignee_name && (
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
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-10">
          Powered by WeddingPlan Kenya · This timeline updates in real time
        </p>
      </div>
    </div>
  );
}
