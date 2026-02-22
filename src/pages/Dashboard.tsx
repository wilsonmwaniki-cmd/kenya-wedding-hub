import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, CheckSquare, Users, Store, Calendar, Heart } from 'lucide-react';
import { motion } from 'framer-motion';

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
  const [stats, setStats] = useState<DashboardStats>({
    totalBudget: 0, totalSpent: 0, totalTasks: 0, completedTasks: 0,
    totalGuests: 0, confirmedGuests: 0, totalVendors: 0,
  });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [budget, tasks, guests, vendors] = await Promise.all([
        supabase.from('budget_categories').select('allocated, spent').eq('user_id', user.id),
        supabase.from('tasks').select('completed').eq('user_id', user.id),
        supabase.from('guests').select('rsvp_status').eq('user_id', user.id),
        supabase.from('vendors').select('id').eq('user_id', user.id),
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
  }, [user]);

  const weddingDate = profile?.wedding_date ? new Date(profile.wedding_date) : null;
  const daysUntil = weddingDate ? Math.max(0, Math.ceil((weddingDate.getTime() - Date.now()) / 86400000)) : null;

  const statCards = [
    { label: 'Budget', value: `KES ${stats.totalSpent.toLocaleString()} / ${stats.totalBudget.toLocaleString()}`, icon: Wallet, color: 'text-primary' },
    { label: 'Tasks', value: `${stats.completedTasks} / ${stats.totalTasks} done`, icon: CheckSquare, color: 'text-success' },
    { label: 'Guests', value: `${stats.confirmedGuests} / ${stats.totalGuests} confirmed`, icon: Users, color: 'text-accent' },
    { label: 'Vendors', value: `${stats.totalVendors} booked`, icon: Store, color: 'text-primary' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          {profile?.full_name ? `Hello, ${profile.full_name.split(' ')[0]}` : 'Your Dashboard'}
        </h1>
        {daysUntil !== null && (
          <p className="mt-1 flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {daysUntil === 0 ? "Today's the day! 🎉" : `${daysUntil} days until your wedding`}
          </p>
        )}
        {!weddingDate && (
          <p className="mt-1 text-muted-foreground">Set your wedding date in settings to see a countdown!</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
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

      {/* Quick tip */}
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
