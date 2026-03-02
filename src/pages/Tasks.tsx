import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Calendar, CalendarPlus, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  category: string | null;
  assigned_to: string | null;
}

export default function Tasks() {
  const { user } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  useEffect(() => {
    if (isPlanner && !selectedClient) navigate('/clients');
  }, [isPlanner, selectedClient, navigate]);

  const load = async () => {
    if (!dataOrFilter) return;
    const { data } = await supabase.from('tasks').select('*').or(dataOrFilter).order('due_date', { ascending: true, nullsFirst: false });
    if (data) setTasks(data as Task[]);
  };

  useEffect(() => { load(); }, [user, selectedClient, dataOrFilter]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const insert: any = { user_id: user.id, title, due_date: dueDate || null, assigned_to: assignedTo || null };
    if (isPlanner && selectedClient) insert.client_id = selectedClient.id;
    const { error } = await supabase.from('tasks').insert(insert);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setDueDate(''); setAssignedTo(''); setOpen(false); load();
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

  if (isPlanner && !selectedClient) return null;

  const TaskCard = ({ t, isDone }: { t: Task; isDone: boolean }) => (
    <Card key={t.id} className={`shadow-card ${isDone ? 'opacity-60' : ''}`}>
      <CardContent className="flex items-center gap-3 py-3">
        <Checkbox checked={isDone} onCheckedChange={() => toggleTask(t.id, t.completed)} />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-card-foreground truncate ${isDone ? 'line-through text-muted-foreground' : ''}`}>{t.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {t.due_date && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" /> {new Date(t.due_date).toLocaleDateString()}
              </p>
            )}
            {t.assigned_to && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <UserCircle className="h-3 w-3" /> {t.assigned_to}
              </p>
            )}
          </div>
        </div>
        {t.due_date && (
          <a
            href={buildGoogleCalendarUrl({ title: t.title, date: t.due_date, description: t.assigned_to ? `Assigned to: ${t.assigned_to}` : undefined })}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Add to Google Calendar"
          >
            <CalendarPlus className="h-4 w-4" />
          </a>
        )}
        <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );

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
              <div className="space-y-2">
                <Label>Assign To (optional)</Label>
                <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="e.g. Couple, Florist, DJ" />
              </div>
              <Button type="submit" className="w-full">Add Task</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {pending.map(t => <TaskCard key={t.id} t={t} isDone={false} />)}
        {done.length > 0 && (
          <>
            <p className="text-sm font-medium text-muted-foreground pt-4">Completed</p>
            {done.map(t => <TaskCard key={t.id} t={t} isDone={true} />)}
          </>
        )}
        {tasks.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No tasks yet. Add your first wedding to-do!</p>
        )}
      </div>
    </div>
  );
}
