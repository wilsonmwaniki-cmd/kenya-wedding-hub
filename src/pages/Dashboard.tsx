import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, CheckSquare, Users, Store, Heart, LinkIcon, Unlink, CalendarPlus, Clock, ChevronRight, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import PlannerBrandingBanner from '@/components/PlannerBrandingBanner';
import MyConnections from '@/components/MyConnections';
import { useToast } from '@/hooks/use-toast';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';

interface DashboardStats {
  totalBudget: number;
  totalSpent: number;
  totalTasks: number;
  completedTasks: number;
  totalGuests: number;
  confirmedGuests: number;
  totalVendors: number;
}

interface UpcomingTimelineEvent {
  id: string;
  event_time: string;
  title: string;
  category: string | null;
  assigned_people: string[];
  timeline_title: string;
  timeline_date: string | null;
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

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter, linkedPlanner, unlinkPlanner } = usePlanner();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalBudget: 0, totalSpent: 0, totalTasks: 0, completedTasks: 0,
    totalGuests: 0, confirmedGuests: 0, totalVendors: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingTimelineEvent[]>([]);

  useEffect(() => {
    if (isPlanner && !selectedClient) {
      navigate('/clients');
    }
  }, [isPlanner, selectedClient, navigate]);

  useEffect(() => {
    if (!user || !dataOrFilter) return;

    const load = async () => {
      const [budget, tasks, guests, vendors] = await Promise.all([
        supabase.from('budget_categories').select('allocated, spent').or(dataOrFilter),
        supabase.from('tasks').select('completed').or(dataOrFilter),
        supabase.from('guests').select('rsvp_status').or(dataOrFilter),
        supabase.from('vendors').select('id').or(dataOrFilter),
      ]);
      setStats({
        totalBudget: budget.data?.reduce((s, b) => s + Number(b.allocated), 0) ?? 0,
        totalSpent: budget.data?.reduce((s, b) => s + Number(b.spent), 0) ?? 0,
        totalTasks: tasks.data?.length ?? 0,
        completedTasks: tasks.data?.filter(t => t.completed).length ?? 0,
        totalGuests: guests.data?.length ?? 0,
        confirmedGuests: guests.data?.filter(g => g.rsvp_status === 'confirmed').length ?? 0,
        totalVendors: vendors.data?.length ?? 0,
      });
    };
    load();

    // Load upcoming timeline events
    const loadTimeline = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: timelines } = await supabase
        .from('timelines')
        .select('id, title, timeline_date')
        .or(dataOrFilter)
        .eq('is_template', false)
        .gte('timeline_date', today)
        .order('timeline_date', { ascending: true })
        .limit(1);
      if (timelines?.length) {
        const tl = timelines[0] as any;
        const { data: evts } = await supabase
          .from('timeline_events')
          .select('id, event_time, title, category, assigned_people')
          .eq('timeline_id', tl.id)
          .order('event_time', { ascending: true })
          .limit(5);
        if (evts) {
          setUpcomingEvents(evts.map((e: any) => ({
            ...e,
            timeline_title: tl.title,
            timeline_date: tl.timeline_date,
          })));
        }
      } else {
        setUpcomingEvents([]);
      }
    };
    loadTimeline();
  }, [user, selectedClient, dataOrFilter]);

  const weddingDate = isPlanner && selectedClient
    ? (selectedClient.wedding_date ? new Date(selectedClient.wedding_date) : null)
    : (profile?.wedding_date ? new Date(profile.wedding_date) : null);

  const daysUntil = weddingDate ? Math.max(0, Math.ceil((weddingDate.getTime() - Date.now()) / 86400000)) : null;
  const weddingTitle = isPlanner && selectedClient
    ? [selectedClient.client_name, selectedClient.partner_name].filter(Boolean).join(' & ')
    : [profile?.full_name, profile?.partner_name].filter(Boolean).join(' & ') || profile?.full_name || 'Your Wedding';
  const weddingLocation = isPlanner && selectedClient ? selectedClient.wedding_location : profile?.wedding_location;
  const weddingMeta = [
    weddingDate ? weddingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null,
    stats.totalGuests > 0 ? `${stats.totalGuests} guests` : null,
    weddingLocation || null,
  ].filter(Boolean) as string[];
  const moduleCards = [
    {
      label: 'Budget',
      href: '/budget',
      summary: `KES ${stats.totalSpent.toLocaleString()} spent of ${stats.totalBudget.toLocaleString()}`,
      description: 'Keep real numbers tied to this wedding.',
      icon: Wallet,
    },
    {
      label: 'Timeline',
      href: '/timeline',
      summary: upcomingEvents[0] ? `${upcomingEvents[0].title} at ${upcomingEvents[0].event_time.slice(0, 5)}` : (weddingDate ? `${daysUntil === 0 ? 'Wedding day is here' : `${daysUntil} days to go`}` : 'Set your wedding date'),
      description: 'See what happens next for this wedding.',
      icon: Clock,
    },
    {
      label: 'Vendors',
      href: '/vendors',
      summary: `${stats.totalVendors} vendors tracked`,
      description: 'Quotes, trust scores, and bookings live here.',
      icon: Store,
    },
    {
      label: 'Guests',
      href: '/guests',
      summary: `${stats.confirmedGuests} confirmed of ${stats.totalGuests}`,
      description: 'Guest list, RSVPs, and seating stay together.',
      icon: Users,
    },
    {
      label: 'Tasks',
      href: '/tasks',
      summary: `${stats.completedTasks} of ${stats.totalTasks} done`,
      description: 'What still needs to happen for this wedding.',
      icon: CheckSquare,
    },
    {
      label: 'Portfolio',
      href: '/portfolio',
      summary: 'Files, vendors, and wedding story',
      description: 'Capture the finished wedding in one place.',
      icon: Heart,
    },
  ];

  if (isPlanner && !selectedClient) return null;

  return (
    <div className="space-y-6">
      <PlannerBrandingBanner />
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/10 shadow-card">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.9fr] lg:p-8">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">This Wedding</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
                {weddingTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Open one wedding and everything stays together: budget, timeline, vendors, guests, and final portfolio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {weddingMeta.length > 0 ? weddingMeta.map((item) => (
                <Badge key={item} variant="outline" className="rounded-full px-3 py-1 text-xs">
                  {item}
                </Badge>
              )) : (
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                  Add date, location, and guests to complete this wedding snapshot
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/budget">Continue Planning</Link>
              </Button>
              {weddingDate && (
                <a
                  href={buildGoogleCalendarUrl({
                    title: `${weddingTitle} Wedding`,
                    date: weddingDate.toISOString().slice(0, 10),
                    location: weddingLocation,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="gap-2">
                    <CalendarPlus className="h-4 w-4" />
                    Add to Calendar
                  </Button>
                </a>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-5 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">At A Glance</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <p className="text-sm text-muted-foreground">Countdown</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {daysUntil === null ? 'No date yet' : daysUntil === 0 ? 'Today' : `${daysUntil} days`}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Budget progress</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {stats.totalBudget > 0 ? `${Math.round((stats.totalSpent / stats.totalBudget) * 100)}%` : '0%'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tasks done</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {stats.completedTasks}/{stats.totalTasks}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="mt-1 flex items-center gap-2 text-base font-medium text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  {weddingLocation || 'Add location'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked planner info for couples */}
      {linkedPlanner && !isPlanner && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <LinkIcon className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-card-foreground text-sm">
                Linked with {linkedPlanner.plannerName || 'your planner'}
              </p>
              <p className="text-xs text-muted-foreground">Your progress is shared — both of you can add and track items.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive gap-1.5 shrink-0"
              onClick={async () => {
                await unlinkPlanner();
                toast({ title: 'Unlinked', description: 'You are no longer linked with this planner.' });
              }}
            >
              <Unlink className="h-3.5 w-3.5" /> Unlink
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Everything For This Wedding</h2>
          <p className="text-sm text-muted-foreground">Jump straight into the part of the wedding you need to work on.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {moduleCards.map((module, i) => (
            <motion.div key={module.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={module.href} className="block h-full">
                <Card className="h-full shadow-card transition-all hover:-translate-y-0.5 hover:shadow-warm">
                  <CardHeader className="flex flex-row items-start justify-between pb-3">
                    <div>
                      <CardTitle className="text-lg">{module.label}</CardTitle>
                      <p className="mt-2 text-sm font-semibold text-foreground">{module.summary}</p>
                    </div>
                    <module.icon className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent className="flex items-center justify-between pt-0">
                    <p className="max-w-[18rem] text-sm text-muted-foreground">{module.description}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {upcomingEvents.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                What Happens Next
                {upcomingEvents[0]?.timeline_date && (
                  <Badge variant="outline" className="text-[10px] font-normal ml-1">
                    {new Date(upcomingEvents[0].timeline_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Badge>
                )}
              </CardTitle>
              <Link to="/timeline" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Open timeline <ChevronRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingEvents.map((ev, i) => {
                  const formatTime = (t: string) => {
                    const [h, m] = t.split(':');
                    const hour = parseInt(h);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    return `${h12}:${m} ${ampm}`;
                  };
                  const catColor = ev.category && CATEGORY_COLORS[ev.category];
                  const catLabel = ev.category && CATEGORY_LABELS[ev.category];
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 py-1.5"
                    >
                      <span className="text-sm font-semibold text-primary font-display min-w-[70px]">{formatTime(ev.event_time)}</span>
                      <span className="text-sm text-card-foreground">{ev.title}</span>
                      {catColor && catLabel && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catColor}`}>{catLabel}</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex h-full items-start gap-4 py-5">
            <Heart className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-card-foreground">Wedding Brain</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep every decision attached to this wedding. When budget, guests, vendors, and timeline live in one place, planners stop jumping between WhatsApp, docs, and spreadsheets.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Connections — couples only */}
      {!isPlanner && <MyConnections />}
    </div>
  );
}
