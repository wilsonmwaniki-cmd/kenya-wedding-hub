import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  category: string | null;
}

export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('due_date', { ascending: true, nullsFirst: false });
    if (data) setTasks(data as Task[]);
  };

  useEffect(() => { load(); }, [user]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from('tasks').insert({
      user_id: user.id, title, due_date: dueDate || null,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setDueDate(''); setOpen(false); load();
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await supabase.from('tasks').update({ completed: !completed }).eq('id', id);
    load();
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    load();
  };

  const pending = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground">{pending.length} pending, {done.length} completed</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Add Task</DialogTitle></DialogHeader>
            <form onSubmit={addTask} className="space-y-4">
              <div className="space-y-2">
                <Label>Task Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Book photographer" required />
              </div>
              <div className="space-y-2">
                <Label>Due Date (optional)</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <Button type="submit" className="w-full">Add Task</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {pending.map(t => (
          <Card key={t.id} className="shadow-card">
            <CardContent className="flex items-center gap-3 py-3">
              <Checkbox checked={false} onCheckedChange={() => toggleTask(t.id, t.completed)} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-card-foreground truncate">{t.title}</p>
                {t.due_date && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Calendar className="h-3 w-3" /> {new Date(t.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        ))}
        {done.length > 0 && (
          <>
            <p className="text-sm font-medium text-muted-foreground pt-4">Completed</p>
            {done.map(t => (
              <Card key={t.id} className="shadow-card opacity-60">
                <CardContent className="flex items-center gap-3 py-3">
                  <Checkbox checked onCheckedChange={() => toggleTask(t.id, t.completed)} />
                  <p className="flex-1 line-through text-muted-foreground truncate">{t.title}</p>
                  <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </>
        )}
        {tasks.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No tasks yet. Add your first wedding to-do!</p>
        )}
      </div>
    </div>
  );
}
