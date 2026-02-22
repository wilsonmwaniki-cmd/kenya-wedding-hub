import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
}

export default function Budget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [allocated, setAllocated] = useState('');

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('budget_categories').select('*').eq('user_id', user.id).order('created_at');
    if (data) setCategories(data.map(d => ({ ...d, allocated: Number(d.allocated), spent: Number(d.spent) })));
  };

  useEffect(() => { load(); }, [user]);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from('budget_categories').insert({
      user_id: user.id, name, allocated: parseFloat(allocated) || 0, spent: 0,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setName(''); setAllocated(''); setOpen(false); load();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from('budget_categories').delete().eq('id', id);
    load();
  };

  const totalAllocated = categories.reduce((s, c) => s + c.allocated, 0);
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Budget</h1>
          <p className="text-muted-foreground">Track your wedding expenses by category</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Add Budget Category</DialogTitle></DialogHeader>
            <form onSubmit={addCategory} className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Venue, Catering" required />
              </div>
              <div className="space-y-2">
                <Label>Allocated Amount (KES)</Label>
                <Input type="number" value={allocated} onChange={e => setAllocated(e.target.value)} placeholder="0" required />
              </div>
              <Button type="submit" className="w-full">Add Category</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <Card className="shadow-card">
        <CardContent className="flex items-center gap-6 py-5">
          <Wallet className="h-10 w-10 text-primary" />
          <div className="flex-1">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>KES {totalSpent.toLocaleString()} spent</span>
              <span>KES {totalAllocated.toLocaleString()} budget</span>
            </div>
            <Progress value={totalAllocated ? (totalSpent / totalAllocated) * 100 : 0} className="h-2.5" />
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map(c => {
          const pct = c.allocated ? Math.min((c.spent / c.allocated) * 100, 100) : 0;
          return (
            <Card key={c.id} className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">{c.name}</CardTitle>
                <button onClick={() => deleteCategory(c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>KES {c.spent.toLocaleString()}</span>
                  <span>KES {c.allocated.toLocaleString()}</span>
                </div>
                <Progress value={pct} className="h-2" />
              </CardContent>
            </Card>
          );
        })}
        {categories.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-12">No budget categories yet. Add one to get started!</p>
        )}
      </div>
    </div>
  );
}
