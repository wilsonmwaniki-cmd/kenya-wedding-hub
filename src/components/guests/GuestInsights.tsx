import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle2, XCircle, Clock, Baby, Star, Utensils } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rsvp_status: string | null;
  meal_preference: string | null;
  plus_one: boolean | null;
  table_number: number | null;
  group_name: string | null;
  category: string | null;
  checked_in: boolean;
}

interface Props {
  guests: Guest[];
}

export default function GuestInsights({ guests }: Props) {
  const total = guests.length;
  const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length;
  const declined = guests.filter(g => g.rsvp_status === 'declined').length;
  const pending = guests.filter(g => g.rsvp_status === 'pending' || !g.rsvp_status).length;
  const plusOnes = guests.filter(g => g.plus_one).length;
  const checkedIn = guests.filter(g => g.checked_in).length;

  // Category breakdown
  const categories = guests.reduce((acc, g) => {
    const cat = g.category || 'general';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group breakdown
  const groups = guests.reduce((acc, g) => {
    const grp = g.group_name || 'Ungrouped';
    acc[grp] = (acc[grp] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stats = [
    { label: 'Total Invited', value: total, icon: Users, color: 'text-foreground' },
    { label: 'Confirmed', value: confirmed, icon: CheckCircle2, color: 'text-success' },
    { label: 'Declined', value: declined, icon: XCircle, color: 'text-destructive' },
    { label: 'Pending', value: pending, icon: Clock, color: 'text-warning' },
  ];

  const confirmRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-4 text-center">
              <s.icon className={`h-5 w-5 mx-auto mb-2 ${s.color}`} />
              <p className="font-display text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Confirmation progress */}
      <Card className="shadow-card">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">RSVP Response Rate</span>
            <span className="font-semibold text-foreground">{confirmRate}%</span>
          </div>
          <Progress value={total > 0 ? ((confirmed + declined) / total) * 100 : 0} />
          <p className="text-xs text-muted-foreground">
            {confirmed + declined} of {total} responded · {plusOnes} plus-ones · {checkedIn} checked in
          </p>
        </CardContent>
      </Card>

      {/* Category + Group breakdown side by side */}
      <div className="grid md:grid-cols-2 gap-3">
        {Object.keys(categories).length > 1 && (
          <Card className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                <Star className="h-3 w-3 inline mr-1" /> By Category
              </p>
              <div className="space-y-2">
                {Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-foreground">{cat}</span>
                    <span className="text-muted-foreground font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {Object.keys(groups).length > 1 && (
          <Card className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                <Users className="h-3 w-3 inline mr-1" /> By Group
              </p>
              <div className="space-y-2">
                {Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([grp, count]) => (
                  <div key={grp} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{grp}</span>
                    <span className="text-muted-foreground font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
