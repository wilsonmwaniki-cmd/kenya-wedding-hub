import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, CheckSquare, Users, Store, Calendar, Heart, LinkIcon, Unlink, CalendarPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter, linkedPlanner, unlinkPlanner } = usePlanner();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalBudget: 0, totalSpent: 0, totalTasks: 0, completedTasks: 0,
    totalGuests: 0, confirmedGuests: 0, totalVendors: 0,
  });

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
  }, [user, selectedClient, dataOrFilter]);

  const displayName = isPlanner && selectedClient
    ? selectedClient.client_name
    : profile?.full_name?.split(' ')[0];

  const weddingDate = isPlanner && selectedClient
    ? (selectedClient.wedding_date ? new Date(selectedClient.wedding_date) : null)
    : (profile?.wedding_date ? new Date(profile.wedding_date) : null);

  const daysUntil = weddingDate ? Math.max(0, Math.ceil((weddingDate.getTime() - Date.now()) / 86400000)) : null;

  const statCards = [
    { label: 'Budget', value: `KES ${stats.totalSpent.toLocaleString()} / ${stats.totalBudget.toLocaleString()}`, icon: Wallet, color: 'text-primary' },
    { label: 'Tasks', value: `${stats.completedTasks} / ${stats.totalTasks} done`, icon: CheckSquare, color: 'text-success' },
    { label: 'Guests', value: `${stats.confirmedGuests} / ${stats.totalGuests} confirmed`, icon: Users, color: 'text-accent' },
    { label: 'Vendors', value: `${stats.totalVendors} booked`, icon: Store, color: 'text-primary' },
  ];

  if (isPlanner && !selectedClient) return null;

  return (
    <div className="space-y-8">
      <PlannerBrandingBanner />
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          {displayName ? `Hello, ${displayName}` : 'Your Dashboard'}
        </h1>
        {daysUntil !== null && weddingDate && (
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{daysUntil === 0 ? "Today's the day! 🎉" : `${daysUntil} days until the wedding`}</span>
            <a
              href={buildGoogleCalendarUrl({
                title: `${displayName || 'Our'} Wedding`,
                date: weddingDate.toISOString().slice(0, 10),
                location: isPlanner && selectedClient ? selectedClient.wedding_location : profile?.wedding_location,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Add to Calendar
            </a>
          </div>
        )}
        {!weddingDate && (
          <p className="mt-1 text-muted-foreground">Set a wedding date to see a countdown!</p>
        )}
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-card-foreground">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* My Connections — couples only */}
      {!isPlanner && <MyConnections />}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 py-5">
          <Heart className="mt-0.5 h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="font-medium text-card-foreground">Planning Tip</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start by setting your budget categories, then add your guest list. This helps you estimate venue size and catering costs early!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
