import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Calendar, CalendarPlus, UserCircle, BriefcaseBusiness, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';
import { createVendorTask } from '@/lib/vendorTasks';

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  category: string | null;
  assigned_to: string | null;
  source_vendor_id: string | null;
}

interface VendorOption {
  id: string;
  name: string;
  category: string;
  selection_status: string;
}

function selectionLabel(status?: string | null) {
  switch (status) {
    case 'final':
      return 'Final';
    case 'backup':
      return 'Backup';
    case 'declined':
      return 'Declined';
    default:
      return 'Shortlisted';
  }
}

export default function Tasks() {
  const { user } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [sourceVendorId, setSourceVendorId] = useState<string>('none');

  useEffect(() => {
    if (isPlanner && !selectedClient) navigate('/clients');
  }, [isPlanner, selectedClient, navigate]);

  const load = async () => {
    if (!dataOrFilter) return;
    const [tasksResult, vendorsResult] = await Promise.all([
      supabase.from('tasks').select('*').or(dataOrFilter).order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('vendors').select('id, name, category, selection_status').or(dataOrFilter).order('name'),
    ]);

    if (tasksResult.data) setTasks(tasksResult.data as Task[]);
    if (vendorsResult.data) setVendorOptions(vendorsResult.data as VendorOption[]);
  };

  useEffect(() => {
    void load();
  }, [user, selectedClient, dataOrFilter]);

  const vendorLookup = useMemo(
    () => Object.fromEntries(vendorOptions.map((vendor) => [vendor.id, vendor])),
    [vendorOptions],
  );

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const linkedVendor = sourceVendorId !== 'none' ? vendorLookup[sourceVendorId] : null;

    try {
      await createVendorTask({
        userId: user.id,
        title,
        description,
        dueDate: dueDate || null,
        assignedTo: assignedTo || null,
        clientId: isPlanner && selectedClient ? selectedClient.id : null,
        sourceVendorId: linkedVendor?.id ?? null,
        category: linkedVendor?.category ?? null,
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      setAssignedTo('');
      setSourceVendorId('none');
      setOpen(false);
      await load();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await supabase.from('tasks').update({ completed: !completed }).eq('id', id);
    load();
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    load();
  };

  const pending = tasks.filter((task) => !task.completed);
  const done = tasks.filter((task) => task.completed);
  const vendorLinkedTasks = tasks.filter((task) => task.source_vendor_id);
  const openVendorTaskCount = vendorLinkedTasks.filter((task) => !task.completed).length;
  const vendorsWithOpenTasks = new Set(
    vendorLinkedTasks.filter((task) => !task.completed && task.source_vendor_id).map((task) => task.source_vendor_id as string),
  ).size;
  const dueSoonVendorTasks = vendorLinkedTasks.filter((task) => {
    if (task.completed || !task.due_date) return false;
    const due = new Date(task.due_date);
    const now = new Date();
    const inSevenDays = new Date();
    inSevenDays.setDate(now.getDate() + 7);
    return due >= now && due <= inSevenDays;
  }).length;

  if (isPlanner && !selectedClient) return null;

  const TaskCard = ({ t, isDone }: { t: Task; isDone: boolean }) => {
    const linkedVendor = t.source_vendor_id ? vendorLookup[t.source_vendor_id] : null;
    return (
      <Card key={t.id} className={`shadow-card ${isDone ? 'opacity-60' : ''}`}>
        <CardContent className="flex items-start gap-3 py-3">
          <Checkbox checked={isDone} onCheckedChange={() => toggleTask(t.id, t.completed)} className="mt-1" />
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-card-foreground truncate ${isDone ? 'line-through text-muted-foreground' : ''}`}>{t.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {linkedVendor && (
                <Badge variant="outline" className="rounded-full text-[11px]">
                  <BriefcaseBusiness className="mr-1 h-3 w-3" />
                  {linkedVendor.name} · {selectionLabel(linkedVendor.selection_status)}
                </Badge>
              )}
              {t.category && (
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  {t.category}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2">
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
            {t.description && <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>}
          </div>
          {t.due_date && (
            <a
              href={buildGoogleCalendarUrl({
                title: t.title,
                date: t.due_date,
                description: [linkedVendor ? `Vendor: ${linkedVendor.name}` : null, t.description, t.assigned_to ? `Assigned to: ${t.assigned_to}` : null]
                  .filter(Boolean)
                  .join('\n'),
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors mt-1"
              title="Add to Google Calendar"
            >
              <CalendarPlus className="h-4 w-4" />
            </a>
          )}
          <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-destructive transition-colors mt-1">
            <Trash2 className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    );
  };

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
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Book photographer" required />
              </div>
              <div className="space-y-2">
                <Label>Linked vendor (optional)</Label>
                <Select value={sourceVendorId} onValueChange={setSourceVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No linked vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked vendor</SelectItem>
                    {vendorOptions.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name} · {vendor.category} · {selectionLabel(vendor.selection_status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date (optional)</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Assign To (optional)</Label>
                <Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="e.g. Couple, committee lead, MC" />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add contract, deposit, or logistics notes..." rows={3} />
              </div>
              <Button type="submit" className="w-full">Add Task</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="py-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link2 className="h-4 w-4" />
              <p className="text-sm font-medium text-foreground">Vendor-linked tasks</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{openVendorTaskCount}</p>
            <p className="text-sm text-muted-foreground">Open tasks tied directly to a vendor choice or shortlist.</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="py-5">
            <p className="text-sm font-medium text-foreground">Vendors with active actions</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{vendorsWithOpenTasks}</p>
            <p className="text-sm text-muted-foreground">Unique vendors currently waiting on contracts, payments, or coordination.</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="py-5">
            <p className="text-sm font-medium text-foreground">Due in the next 7 days</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{dueSoonVendorTasks}</p>
            <p className="text-sm text-muted-foreground">Vendor-linked tasks that need attention this week.</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {pending.map((task) => <TaskCard key={task.id} t={task} isDone={false} />)}
        {done.length > 0 && (
          <>
            <p className="text-sm font-medium text-muted-foreground pt-4">Completed</p>
            {done.map((task) => <TaskCard key={task.id} t={task} isDone />)}
          </>
        )}
        {tasks.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No tasks yet. Add your first planning to-do.</p>
        )}
      </div>
    </div>
  );
}
