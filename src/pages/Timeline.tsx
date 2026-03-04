import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Clock, Trash2, Edit2, Copy, Link2, Users, ArrowLeft,
  Calendar, FileText, ChevronRight, Share2, X, Check, Timer, GripVertical, MessageCircle, Printer
} from 'lucide-react';

interface Timeline {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  timeline_date: string | null;
  is_template: boolean;
  share_token: string;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  timeline_id: string;
  event_time: string;
  title: string;
  description: string | null;
  assigned_people: string[];
  sort_order: number;
}

interface ShareLink {
  id: string;
  timeline_id: string;
  assignee_name: string;
  share_token: string;
}

export default function Timeline() {
  const { user } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const { toast } = useToast();

  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Create timeline dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newIsTemplate, setNewIsTemplate] = useState(false);
  const [fromTemplateId, setFromTemplateId] = useState<string | null>(null);

  // Event editing
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventTime, setEventTime] = useState('07:00');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventAssigned, setEventAssigned] = useState('');

  // Share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Shift dialog
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftMinutes, setShiftMinutes] = useState(30);

  // Drag-and-drop
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const baseUrl = window.location.origin;

  // Load timelines
  const loadTimelines = async () => {
    if (!user || !dataOrFilter) return;
    setLoading(true);
    const { data } = await supabase
      .from('timelines')
      .select('*')
      .or(dataOrFilter)
      .order('created_at', { ascending: false });
    if (data) setTimelines(data as Timeline[]);
    setLoading(false);
  };

  useEffect(() => {
    loadTimelines();
  }, [user, dataOrFilter]);

  // Load events for selected timeline
  const loadEvents = async (timelineId: string) => {
    const { data } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('timeline_id', timelineId)
      .order('sort_order', { ascending: true })
      .order('event_time', { ascending: true });
    if (data) setEvents(data as TimelineEvent[]);
  };

  const loadShareLinks = async (timelineId: string) => {
    const { data } = await supabase
      .from('timeline_share_links')
      .select('*')
      .eq('timeline_id', timelineId);
    if (data) setShareLinks(data as ShareLink[]);
  };

  const selectTimeline = (t: Timeline) => {
    setSelectedTimeline(t);
    loadEvents(t.id);
    loadShareLinks(t.id);
  };

  // All unique assignees across events
  const allAssignees = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => e.assigned_people.forEach(p => set.add(p)));
    return Array.from(set).sort();
  }, [events]);

  // Create timeline
  const handleCreate = async () => {
    if (!user || !newTitle.trim()) return;
    const payload: any = {
      user_id: user.id,
      title: newTitle.trim(),
      is_template: newIsTemplate,
      timeline_date: newDate || null,
      client_id: isPlanner && selectedClient ? selectedClient.id : null,
    };
    const { data, error } = await supabase.from('timelines').insert(payload).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    // If creating from template, copy events
    if (fromTemplateId && data) {
      const { data: templateEvents } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('timeline_id', fromTemplateId)
        .order('event_time');
      if (templateEvents?.length) {
        const copies = templateEvents.map((te: any) => ({
          timeline_id: (data as any).id,
          event_time: te.event_time,
          title: te.title,
          description: te.description,
          assigned_people: te.assigned_people,
          sort_order: te.sort_order,
        }));
        await supabase.from('timeline_events').insert(copies);
      }
    }

    toast({ title: newIsTemplate ? 'Template created' : 'Timeline created' });
    setCreateOpen(false);
    setNewTitle('');
    setNewDate('');
    setNewIsTemplate(false);
    setFromTemplateId(null);
    loadTimelines();
    if (data) selectTimeline(data as Timeline);
  };

  const deleteTimeline = async (id: string) => {
    await supabase.from('timelines').delete().eq('id', id);
    if (selectedTimeline?.id === id) { setSelectedTimeline(null); setEvents([]); }
    loadTimelines();
    toast({ title: 'Deleted' });
  };

  // Event CRUD
  const openNewEvent = () => {
    setEditingEvent(null);
    setEventTime('07:00');
    setEventTitle('');
    setEventDesc('');
    setEventAssigned('');
    setEventDialogOpen(true);
  };

  const openEditEvent = (ev: TimelineEvent) => {
    setEditingEvent(ev);
    setEventTime(ev.event_time.slice(0, 5));
    setEventTitle(ev.title);
    setEventDesc(ev.description || '');
    setEventAssigned(ev.assigned_people.join(', '));
    setEventDialogOpen(true);
  };

  const saveEvent = async () => {
    if (!selectedTimeline || !eventTitle.trim()) return;
    const assigned = eventAssigned.split(',').map(s => s.trim()).filter(Boolean);
    const payload = {
      timeline_id: selectedTimeline.id,
      event_time: eventTime + ':00',
      title: eventTitle.trim(),
      description: eventDesc.trim() || null,
      assigned_people: assigned,
      sort_order: editingEvent?.sort_order ?? events.length,
    };

    if (editingEvent) {
      await supabase.from('timeline_events').update(payload).eq('id', editingEvent.id);
    } else {
      await supabase.from('timeline_events').insert(payload);
    }

    setEventDialogOpen(false);
    loadEvents(selectedTimeline.id);

    // Auto-create share links for new assignees
    for (const name of assigned) {
      if (!shareLinks.find(sl => sl.assignee_name === name)) {
        await supabase.from('timeline_share_links').insert({
          timeline_id: selectedTimeline.id,
          assignee_name: name,
        });
      }
    }
    loadShareLinks(selectedTimeline.id);
  };

  const deleteEvent = async (id: string) => {
    if (!selectedTimeline) return;
    await supabase.from('timeline_events').delete().eq('id', id);
    loadEvents(selectedTimeline.id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Link copied!' });
  };

  const shiftAllEvents = async (direction: 'forward' | 'backward') => {
    if (!selectedTimeline || events.length === 0) return;
    const delta = direction === 'forward' ? shiftMinutes : -shiftMinutes;
    const updates = events.map(ev => {
      const [h, m] = ev.event_time.split(':').map(Number);
      const totalMin = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + delta));
      const newH = String(Math.floor(totalMin / 60)).padStart(2, '0');
      const newM = String(totalMin % 60).padStart(2, '0');
      return { id: ev.id, event_time: `${newH}:${newM}:00` };
    });
    for (const u of updates) {
      await supabase.from('timeline_events').update({ event_time: u.event_time }).eq('id', u.id);
    }
    loadEvents(selectedTimeline.id);
    setShiftDialogOpen(false);
    toast({ title: `Shifted all events ${shiftMinutes} min ${direction}` });
  };

  const handleDrop = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || !selectedTimeline) return;
    const reordered = [...events];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    // Optimistic update
    setEvents(reordered);
    // Persist new sort_order
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await supabase.from('timeline_events').update({ sort_order: i }).eq('id', reordered[i].id);
      }
    }
    loadEvents(selectedTimeline.id);
  };

  const templates = timelines.filter(t => t.is_template);
  const instances = timelines.filter(t => !t.is_template);

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  // Detail view
  if (selectedTimeline) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="print:hidden" onClick={() => { setSelectedTimeline(null); setEvents([]); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              {selectedTimeline.title}
              {selectedTimeline.is_template && <Badge variant="secondary" className="text-xs">Template</Badge>}
            </h1>
            {selectedTimeline.timeline_date && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(selectedTimeline.timeline_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
          {events.length > 0 && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={() => setShiftDialogOpen(true)}>
                <Timer className="h-4 w-4" /> Shift All
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={() => setShareDialogOpen(true)}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button size="sm" className="gap-1.5 print:hidden" onClick={openNewEvent}>
            <Plus className="h-4 w-4" /> Add Event
          </Button>
        </div>

        {/* Visual timeline */}
        <div className="relative">
          {events.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">No events yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add your first event to start building the timeline</p>
                <Button size="sm" className="mt-4 gap-1.5" onClick={openNewEvent}>
                  <Plus className="h-4 w-4" /> Add First Event
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="relative ml-4 border-l-2 border-primary/20 pl-6 space-y-1">
                {events.map((ev, i) => (
                  <div
                    key={ev.id}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                    onDragEnd={() => { if (dragIndex !== null && dragOverIndex !== null) handleDrop(dragIndex, dragOverIndex); setDragIndex(null); setDragOverIndex(null); }}
                    className={`relative group transition-all ${dragIndex === i ? 'opacity-40 scale-[0.98]' : ''} ${dragOverIndex === i && dragIndex !== null && dragIndex !== i ? 'border-t-2 border-primary pt-1' : ''}`}
                  >
                    {/* Dot on the timeline */}
                    <div className="absolute -left-[31px] top-4 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background" />

                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="flex items-start gap-2 py-4 px-5">
                        <div className="shrink-0 cursor-grab active:cursor-grabbing pt-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="shrink-0 min-w-[80px]">
                          <p className="text-lg font-bold text-primary font-display">{formatTime(ev.event_time)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-card-foreground">{ev.title}</p>
                          {ev.description && <p className="text-sm text-muted-foreground mt-0.5">{ev.description}</p>}
                          {ev.assigned_people.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {ev.assigned_people.map(p => (
                                <Badge key={p} variant="outline" className="text-xs font-normal">
                                  {p}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditEvent(ev)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteEvent(ev.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Event dialog */}
        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Time</Label>
                  <Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Title</Label>
                  <Input placeholder="e.g. Ceremony start" value={eventTitle} onChange={e => setEventTitle(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea placeholder="Additional details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Assigned People</Label>
                <Input placeholder="e.g. Photographer, MC, Planner (comma-separated)" value={eventAssigned} onChange={e => setEventAssigned(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Each person will get a unique shareable link</p>
              </div>
              <Button className="w-full" onClick={saveEvent}>
                <Check className="h-4 w-4 mr-1.5" /> {editingEvent ? 'Save Changes' : 'Add Event'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" /> Share Timeline
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 mt-2">
              {/* Full timeline link */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Full Timeline Link</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input readOnly value={`${baseUrl}/timeline/share/${selectedTimeline.share_token}`} className="text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(`${baseUrl}/timeline/share/${selectedTimeline.share_token}`)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50" asChild>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Here's the wedding timeline for "${selectedTimeline.title}":\n${baseUrl}/timeline/share/${selectedTimeline.share_token}`)}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Anyone with this link sees the full timeline</p>
              </div>

              {/* Per-person links */}
              {shareLinks.length > 0 && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Individual Links</Label>
                  <div className="space-y-2 mt-1.5">
                    {shareLinks.map(sl => {
                      const link = `${baseUrl}/timeline/share/${sl.share_token}`;
                      const waText = encodeURIComponent(`Hi ${sl.assignee_name}! Here's your timeline for "${selectedTimeline.title}":\n${link}`);
                      return (
                        <div key={sl.id} className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0">{sl.assignee_name}</Badge>
                          <Input readOnly value={link} className="text-xs flex-1" />
                          <Button size="icon" variant="outline" className="shrink-0" onClick={() => copyToClipboard(link)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50" asChild>
                            <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Each person only sees events assigned to them</p>
                </div>
              )}

              {allAssignees.length === 0 && shareLinks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add events with assigned people to generate individual share links
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Shift dialog */}
        <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" /> Shift All Events
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Minutes</Label>
                <Input type="number" min={1} max={480} value={shiftMinutes} onChange={e => setShiftMinutes(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-1.5" onClick={() => shiftAllEvents('backward')}>
                  − {shiftMinutes} min
                </Button>
                <Button className="gap-1.5" onClick={() => shiftAllEvents('forward')}>
                  + {shiftMinutes} min
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">All events will be shifted. Times are clamped to 00:00–23:59.</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Wedding Timeline</h1>
          <p className="text-muted-foreground mt-1">Build, share, and keep everyone synced in real time</p>
        </div>
        <Button className="gap-1.5" onClick={() => { setNewIsTemplate(false); setFromTemplateId(null); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> New Timeline
        </Button>
      </div>

      <Tabs defaultValue="timelines">
        <TabsList>
          <TabsTrigger value="timelines">Timelines ({instances.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="timelines" className="mt-4">
          {instances.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">No timelines yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Create one from scratch or from a template</p>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="gap-1.5" onClick={() => { setNewIsTemplate(false); setFromTemplateId(null); setCreateOpen(true); }}>
                    <Plus className="h-4 w-4" /> Create New
                  </Button>
                  {templates.length > 0 && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNewIsTemplate(false); setFromTemplateId(templates[0].id); setCreateOpen(true); }}>
                      <FileText className="h-4 w-4" /> From Template
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {instances.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => selectTimeline(t)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{t.title}</CardTitle>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {t.timeline_date && (
                        <CardDescription className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(t.timeline_date).toLocaleDateString()}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex items-center justify-between">
                        <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground p-0 h-auto" onClick={e => { e.stopPropagation(); copyToClipboard(`${baseUrl}/timeline/share/${t.share_token}`); }}>
                          <Link2 className="h-3 w-3" /> Copy link
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); deleteTimeline(t.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          {templates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">No templates yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Create a reusable template to quickly spin up timelines</p>
                <Button size="sm" className="mt-4 gap-1.5" onClick={() => { setNewIsTemplate(true); setFromTemplateId(null); setCreateOpen(true); }}>
                  <Plus className="h-4 w-4" /> Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => selectTimeline(t)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          {t.title}
                          <Badge variant="secondary" className="text-[10px]">Template</Badge>
                        </CardTitle>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline" size="sm" className="text-xs gap-1"
                          onClick={e => {
                            e.stopPropagation();
                            setNewIsTemplate(false);
                            setFromTemplateId(t.id);
                            setNewTitle(`${t.title} — Copy`);
                            setCreateOpen(true);
                          }}
                        >
                          <Copy className="h-3 w-3" /> Use Template
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); deleteTimeline(t.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newIsTemplate ? 'Create Template' : fromTemplateId ? 'Create from Template' : 'Create Timeline'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Title</Label>
              <Input placeholder={newIsTemplate ? 'e.g. Standard Wedding Day' : 'e.g. Our Wedding Day'} value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </div>
            {!newIsTemplate && (
              <div>
                <Label>Date</Label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
            )}
            {!newIsTemplate && templates.length > 0 && !fromTemplateId && (
              <div>
                <Label>Start from template (optional)</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={fromTemplateId || ''}
                  onChange={e => setFromTemplateId(e.target.value || null)}
                >
                  <option value="">Blank timeline</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            )}
            <Button className="w-full" onClick={handleCreate} disabled={!newTitle.trim()}>
              <Check className="h-4 w-4 mr-1.5" /> Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
