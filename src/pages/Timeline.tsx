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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';
import InfoTip from '@/components/InfoTip';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Clock, Trash2, Edit2, Copy, Link2, Users, ArrowLeft,
  Calendar, FileText, ChevronRight, Share2, X, Check, Timer, GripVertical, MessageCircle, Printer, RotateCw, ShieldOff
} from 'lucide-react';
import { submitPlannerChangeRequest } from '@/lib/plannerChangeRequests';
import { WorkspacePageSkeleton } from '@/components/AppLoadingSkeletons';
import { normalizeInvokeError } from '@/lib/invokeErrors';
import { useDeferredDelete } from '@/hooks/useDeferredDelete';

const VENDOR_ROLES = [
  { value: 'photographer', label: 'Photographer', icon: '📸' },
  { value: 'videographer', label: 'Videographer', icon: '🎬' },
  { value: 'mc', label: 'MC / Host', icon: '🎤' },
  { value: 'makeup', label: 'Makeup Artist', icon: '💄' },
  { value: 'hair', label: 'Hair Stylist', icon: '💇' },
  { value: 'dj', label: 'DJ', icon: '🎵' },
  { value: 'florist', label: 'Florist', icon: '💐' },
  { value: 'caterer', label: 'Caterer', icon: '🍽️' },
  { value: 'decorator', label: 'Decorator', icon: 'D' },
  { value: 'planner', label: 'Planner', icon: '📋' },
  { value: 'transport', label: 'Transport', icon: '🚗' },
  { value: 'officiant', label: 'Officiant', icon: '💍' },
  { value: 'other', label: 'Other', icon: '👤' },
] as const;

const getVendorRole = (role: string | null) =>
  VENDOR_ROLES.find(r => r.value === role) || null;

const EVENT_CATEGORIES = [
  { value: 'prep', label: 'Prep', color: 'bg-primary/10 text-primary border-primary/20', dot: 'bg-primary' },
  { value: 'ceremony', label: 'Ceremony', color: 'bg-accent/20 text-foreground border-accent/40', dot: 'bg-accent' },
  { value: 'reception', label: 'Reception', color: 'bg-primary/15 text-foreground border-primary/25', dot: 'bg-primary/80' },
  { value: 'transport', label: 'Transport', color: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground/70' },
  { value: 'photo', label: 'Photo/Video', color: 'bg-primary/8 text-primary border-primary/15', dot: 'bg-primary/70' },
  { value: 'food', label: 'Food & Drinks', color: 'bg-accent/15 text-foreground border-accent/30', dot: 'bg-accent/80' },
  { value: 'entertainment', label: 'Entertainment', color: 'bg-primary/12 text-primary border-primary/20', dot: 'bg-primary/75' },
  { value: 'other', label: 'Other', color: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground/70' },
] as const;

const getCategoryMeta = (cat: string | null) =>
  EVENT_CATEGORIES.find(c => c.value === cat) || null;

interface Timeline {
  id: string;
  user_id: string;
  client_id: string | null;
  wedding_id?: string | null;
  title: string;
  timeline_date: string | null;
  is_template: boolean;
  share_token: string;
  share_expires_at?: string | null;
  share_revoked_at?: string | null;
  share_last_accessed_at?: string | null;
  share_access_count?: number;
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
  category: string | null;
}

async function invokeTimelineOperation(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('timeline-ops', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error as string);
  return data;
}

interface ShareLink {
  id: string;
  timeline_id: string;
  assignee_name: string;
  share_token: string;
  vendor_role: string | null;
  email: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  last_accessed_at?: string | null;
  access_count?: number;
}

function isTokenActive(expiresAt?: string | null, revokedAt?: string | null) {
  if (revokedAt) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export default function Timeline() {
  const { user } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const { toast } = useToast();
  const { pendingIds: pendingDeleteIds, scheduleDelete } = useDeferredDelete();
  const assistantPanel = useAssistantPanel();
  const plannerNeedsApproval = isPlanner && Boolean(selectedClient?.linked_user_id);

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
  const [ceremonyCenterTime, setCeremonyCenterTime] = useState('11:00');
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [selectedTemplateForApply, setSelectedTemplateForApply] = useState<Timeline | null>(null);
  const [templatePreviewEvents, setTemplatePreviewEvents] = useState<TimelineEvent[]>([]);
  const [applyLoading, setApplyLoading] = useState(false);

  // Event editing
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventTime, setEventTime] = useState('07:00');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventAssigned, setEventAssigned] = useState('');
  const [eventCategory, setEventCategory] = useState<string | null>(null);
  // Share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Shift dialog
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftMinutes, setShiftMinutes] = useState(30);

  // Drag-and-drop
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Category filter
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const baseUrl = window.location.origin;
  const selectedTimelineShareActive = selectedTimeline
    ? isTokenActive(selectedTimeline.share_expires_at, selectedTimeline.share_revoked_at)
    : false;
  const templates = timelines.filter(t => t.is_template && !pendingDeleteIds.has(t.id));
  const instances = timelines.filter(t => !t.is_template && !pendingDeleteIds.has(t.id));
  const visibleEvents = events.filter((event) => !pendingDeleteIds.has(event.id));
  const timelineHeroAction = instances.length === 0
    ? 'Build the first timeline'
    : selectedTimeline
      ? 'Review the selected timeline flow'
      : instances.length === 1
        ? 'Refine the current wedding flow'
        : 'Keep every timeline version in sync';

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

  // Open "Apply Template" wizard
  const openApplyTemplate = async (template: Timeline) => {
    setSelectedTemplateForApply(template);
    setNewTitle(`${template.title}`);
    setNewDate('');
    setCeremonyCenterTime('11:00');
    // Load template events for preview & anchor detection
    const { data } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('timeline_id', template.id)
      .order('event_time', { ascending: true });
    setTemplatePreviewEvents((data as TimelineEvent[]) || []);
    setApplyTemplateOpen(true);
  };

  // Calculate time offset and create instance from template
  const handleApplyTemplate = async () => {
    if (plannerNeedsApproval) {
      toast({
        title: 'Template cloning stays with the couple',
        description: 'Use standard timeline requests here so the couple can review changes more clearly.',
        variant: 'destructive',
      });
      return;
    }
    if (!user || !selectedTemplateForApply || !newTitle.trim() || !newDate) return;
    setApplyLoading(true);

    // Find the ceremony anchor event (first "ceremony" category, or first event)
    const anchorEvent = templatePreviewEvents.find(e => e.category === 'ceremony') || templatePreviewEvents[0];
    if (!anchorEvent) { setApplyLoading(false); return; }

    const [anchorH, anchorM] = anchorEvent.event_time.split(':').map(Number);
    const [targetH, targetM] = ceremonyCenterTime.split(':').map(Number);
    const offsetMin = (targetH * 60 + targetM) - (anchorH * 60 + anchorM);

    // Create the new timeline instance
    const payload: any = {
      user_id: user.id,
      title: newTitle.trim(),
      is_template: false,
      timeline_date: newDate,
      client_id: isPlanner && selectedClient ? selectedClient.id : null,
      wedding_id: isPlanner ? selectedClient?.wedding_id ?? null : null,
    };
    const { data: newTimeline, error } = await supabase.from('timelines').insert(payload).select().single();
    if (error || !newTimeline) {
      toast({ title: 'Error', description: error?.message || 'Failed to create timeline', variant: 'destructive' });
      setApplyLoading(false);
      return;
    }

    // Copy events with time offset applied
    if (templatePreviewEvents.length > 0) {
      const copies = templatePreviewEvents.map(te => {
        const [h, m] = te.event_time.split(':').map(Number);
        const totalMin = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + offsetMin));
        const newH = String(Math.floor(totalMin / 60)).padStart(2, '0');
        const newM = String(totalMin % 60).padStart(2, '0');
        return {
          timeline_id: (newTimeline as any).id,
          event_time: `${newH}:${newM}:00`,
          title: te.title,
          description: te.description,
          assigned_people: te.assigned_people,
          sort_order: te.sort_order,
          category: te.category,
        };
      });
      await supabase.from('timeline_events').insert(copies);
    }

    toast({ title: 'Timeline created from template!' });
    setApplyTemplateOpen(false);
    setSelectedTemplateForApply(null);
    setTemplatePreviewEvents([]);
    setApplyLoading(false);
    loadTimelines();
    selectTimeline(newTimeline as Timeline);
  };

  // Create timeline
  const handleCreate = async () => {
    if (!user || !newTitle.trim()) return;
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      await submitPlannerChangeRequest({
        clientId: selectedClient.id,
        coupleUserId: selectedClient.linked_user_id,
        plannerUserId: user.id,
        targetTable: 'timelines',
        changeType: 'create',
        proposedPayload: {
          title: newTitle.trim(),
          is_template: newIsTemplate,
          timeline_date: newDate || null,
          wedding_id: selectedClient.wedding_id ?? null,
        },
      });
      toast({
        title: 'Timeline request sent for approval',
        description: 'The couple will review this timeline before it goes live.',
      });
      setCreateOpen(false);
      setNewTitle('');
      setNewDate('');
      setNewIsTemplate(false);
      setFromTemplateId(null);
      return;
    }
    const payload: any = {
      user_id: user.id,
      title: newTitle.trim(),
      is_template: newIsTemplate,
      timeline_date: newDate || null,
      client_id: isPlanner && selectedClient ? selectedClient.id : null,
      wedding_id: isPlanner ? selectedClient?.wedding_id ?? null : null,
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
          category: te.category,
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
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      const timeline = timelines.find((row) => row.id === id);
      if (!timeline) return;
      await submitPlannerChangeRequest({
        clientId: selectedClient.id,
        coupleUserId: selectedClient.linked_user_id,
        plannerUserId: user!.id,
        targetTable: 'timelines',
        changeType: 'delete',
        targetId: id,
        currentPayload: timeline as unknown as Record<string, unknown>,
        proposedPayload: { title: timeline.title },
      });
      toast({
        title: 'Timeline removal sent for approval',
        description: `${timeline.title} will only be removed if the couple approves it.`,
      });
      return;
    }
    const timeline = timelines.find((row) => row.id === id);
    if (!timeline) return;
    const wasSelected = selectedTimeline?.id === id;
    if (wasSelected) { setSelectedTimeline(null); setEvents([]); }
    scheduleDelete({
      id,
      title: 'Timeline removed',
      description: `${timeline.title} was removed.`,
      commit: async () => {
        const { error } = await supabase.from('timelines').delete().eq('id', id);
        if (error) throw error;
      },
      onCommit: loadTimelines,
      onUndo: () => {
        if (wasSelected) selectTimeline(timeline);
      },
    });
  };

  // Event CRUD
  const openNewEvent = () => {
    setEditingEvent(null);
    setEventTime('07:00');
    setEventTitle('');
    setEventDesc('');
    setEventAssigned('');
    setEventCategory(null);
    setEventDialogOpen(true);
  };

  const openEditEvent = (ev: TimelineEvent) => {
    setEditingEvent(ev);
    setEventTime(ev.event_time.slice(0, 5));
    setEventTitle(ev.title);
    setEventDesc(ev.description || '');
    setEventAssigned(ev.assigned_people.join(', '));
    setEventCategory(ev.category);
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
      category: eventCategory,
      sort_order: editingEvent?.sort_order ?? events.length,
    };

    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      await submitPlannerChangeRequest({
        clientId: selectedClient.id,
        coupleUserId: selectedClient.linked_user_id,
        plannerUserId: user!.id,
        targetTable: 'timeline_events',
        changeType: editingEvent ? 'update' : 'create',
        targetId: editingEvent?.id ?? null,
        currentPayload: editingEvent as unknown as Record<string, unknown> | null,
        proposedPayload: payload,
      });
      toast({
        title: editingEvent ? 'Timeline event sent for approval' : 'Timeline event request sent for approval',
        description: 'The couple will review this timeline event before it goes live.',
      });
      setEventDialogOpen(false);
      return;
    }

    const idempotencyKey = window.crypto?.randomUUID?.() ?? `${selectedTimeline.id}-${Date.now()}`;
    try {
      await invokeTimelineOperation({
        action: editingEvent ? 'update_event' : 'create_event',
        timelineId: selectedTimeline.id,
        timelineEventId: editingEvent?.id ?? null,
        idempotencyKey,
        eventTime,
        title: eventTitle.trim(),
        description: eventDesc.trim() || null,
        assignedPeople: assigned,
        category: eventCategory,
        sortOrder: payload.sort_order,
      });
    } catch (error) {
      const normalized = await normalizeInvokeError(
        error,
        editingEvent ? 'Could not update this timeline event.' : 'Could not create this timeline event.',
      );
      toast({ title: 'Timeline update failed', description: normalized.message, variant: 'destructive' });
      return;
    }

    setEventDialogOpen(false);
    loadEvents(selectedTimeline.id);
    loadShareLinks(selectedTimeline.id);
  };

  const deleteEvent = async (id: string) => {
    if (!selectedTimeline) return;
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      const event = events.find((row) => row.id === id);
      if (!event) return;
      await submitPlannerChangeRequest({
        clientId: selectedClient.id,
        coupleUserId: selectedClient.linked_user_id,
        plannerUserId: user!.id,
        targetTable: 'timeline_events',
        changeType: 'delete',
        targetId: id,
        currentPayload: event as unknown as Record<string, unknown>,
        proposedPayload: { title: event.title, event_time: event.event_time },
      });
      toast({
        title: 'Timeline event removal sent for approval',
        description: `${event.title} will only be removed if the couple approves it.`,
      });
      return;
    }
    const event = events.find((row) => row.id === id);
    if (!event) return;
    const timelineId = selectedTimeline.id;
    scheduleDelete({
      id,
      title: 'Timeline event removed',
      description: `${event.title} was removed from the timeline.`,
      commit: async () => {
        const idempotencyKey = window.crypto?.randomUUID?.() ?? `${id}-${Date.now()}`;
        await invokeTimelineOperation({
          action: 'delete_event',
          timelineId,
          timelineEventId: id,
          idempotencyKey,
        });
      },
      onCommit: () => loadEvents(timelineId),
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Link copied!' });
  };

  const refreshSelectedTimelineRow = async (timelineId: string) => {
    const { data } = await supabase
      .from('timelines')
      .select('*')
      .eq('id', timelineId)
      .maybeSingle();

    if (!data) return;

    setSelectedTimeline(data as Timeline);
    setTimelines((prev) => prev.map((timeline) => (timeline.id === timelineId ? (data as Timeline) : timeline)));
  };

  if (loading) return <WorkspacePageSkeleton compact />;

  const refreshFullTimelineLink = async () => {
    if (plannerNeedsApproval) return;
    if (!selectedTimeline) return;

    const { error } = await supabase
      .from('timelines')
      .update({
        share_token: crypto.randomUUID(),
        share_revoked_at: null,
        share_expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        share_last_accessed_at: null,
        share_access_count: 0,
      } as never)
      .eq('id', selectedTimeline.id);

    if (error) {
      toast({ title: 'Could not refresh full timeline link', description: error.message, variant: 'destructive' });
      return;
    }

    await refreshSelectedTimelineRow(selectedTimeline.id);
    toast({ title: 'Full timeline link refreshed', description: 'A new public timeline link is ready to share.' });
  };

  const revokeFullTimelineLink = async () => {
    if (plannerNeedsApproval) return;
    if (!selectedTimeline) return;

    const { error } = await supabase
      .from('timelines')
      .update({
        share_revoked_at: new Date().toISOString(),
      } as never)
      .eq('id', selectedTimeline.id);

    if (error) {
      toast({ title: 'Could not revoke full timeline link', description: error.message, variant: 'destructive' });
      return;
    }

    await refreshSelectedTimelineRow(selectedTimeline.id);
    toast({ title: 'Full timeline link revoked', description: 'The current public timeline link is now inactive.' });
  };

  const refreshAssigneeShareLink = async (shareLink: ShareLink) => {
    if (plannerNeedsApproval) return;
    const { error } = await supabase
      .from('timeline_share_links')
      .update({
        share_token: crypto.randomUUID(),
        revoked_at: null,
        expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        last_accessed_at: null,
        access_count: 0,
      } as never)
      .eq('id', shareLink.id);

    if (error) {
      toast({ title: 'Could not refresh personal timeline link', description: error.message, variant: 'destructive' });
      return;
    }

    await loadShareLinks(shareLink.timeline_id);
    toast({ title: 'Personal timeline link refreshed', description: `A new link is ready for ${shareLink.assignee_name}.` });
  };

  const revokeAssigneeShareLink = async (shareLink: ShareLink) => {
    if (plannerNeedsApproval) return;
    const { error } = await supabase
      .from('timeline_share_links')
      .update({
        revoked_at: new Date().toISOString(),
      } as never)
      .eq('id', shareLink.id);

    if (error) {
      toast({ title: 'Could not revoke personal timeline link', description: error.message, variant: 'destructive' });
      return;
    }

    await loadShareLinks(shareLink.timeline_id);
    toast({ title: 'Personal timeline link revoked', description: `${shareLink.assignee_name}'s current link is now inactive.` });
  };

  const shiftAllEvents = async (direction: 'forward' | 'backward') => {
    if (plannerNeedsApproval) {
      toast({
        title: 'Bulk timeline shifting stays with the couple',
        description: 'Use event-specific requests instead of changing the live timeline in bulk.',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedTimeline || events.length === 0) return;
    const delta = direction === 'forward' ? shiftMinutes : -shiftMinutes;
    const idempotencyKey = window.crypto?.randomUUID?.() ?? `${selectedTimeline.id}-${Date.now()}`;
    try {
      await invokeTimelineOperation({
        action: 'shift_events',
        timelineId: selectedTimeline.id,
        idempotencyKey,
        shiftMinutes: delta,
      });
    } catch (error) {
      const normalized = await normalizeInvokeError(error, 'Could not shift the timeline right now.');
      toast({ title: 'Timeline update failed', description: normalized.message, variant: 'destructive' });
      return;
    }
    loadEvents(selectedTimeline.id);
    setShiftDialogOpen(false);
    toast({ title: `Shifted all events ${shiftMinutes} min ${direction}` });
  };

  const handleDrop = async (fromId: string, toId: string) => {
    if (plannerNeedsApproval) {
      toast({
        title: 'Timeline reordering stays with the couple',
        description: 'Use event-specific requests instead of reordering the live timeline directly.',
        variant: 'destructive',
      });
      return;
    }
    if (fromId === toId || !selectedTimeline || pendingDeleteIds.size > 0) return;
    const reordered = [...events];
    const fromIdx = reordered.findIndex((event) => event.id === fromId);
    const toIdx = reordered.findIndex((event) => event.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    // Optimistic update
    setEvents(reordered);
    const idempotencyKey = window.crypto?.randomUUID?.() ?? `${selectedTimeline.id}-${Date.now()}`;
    try {
      await invokeTimelineOperation({
        action: 'reorder_events',
        timelineId: selectedTimeline.id,
        idempotencyKey,
        orderedEventIds: reordered.map((event) => event.id),
      });
    } catch (error) {
      const normalized = await normalizeInvokeError(error, 'Could not reorder this timeline right now.');
      toast({ title: 'Timeline update failed', description: normalized.message, variant: 'destructive' });
      await loadEvents(selectedTimeline.id);
      return;
    }
    loadEvents(selectedTimeline.id);
  };

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
            <h1 className="workspace-h1 flex items-center gap-2">
              {selectedTimeline.title}
              {selectedTimeline.is_template && <Badge variant="info" className="text-xs">Template</Badge>}
            </h1>
            {selectedTimeline.timeline_date && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(selectedTimeline.timeline_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
          {visibleEvents.length > 0 && (
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

        {/* Category filter bar */}
        {visibleEvents.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="text-xs text-muted-foreground font-medium">Filter:</span>
            <button
              onClick={() => setFilterCategory(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${!filterCategory ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-border hover:border-foreground/30'}`}
            >
              All
            </button>
            {EVENT_CATEGORIES.filter(c => visibleEvents.some(e => e.category === c.value)).map(c => (
              <button
                key={c.value}
                onClick={() => setFilterCategory(filterCategory === c.value ? null : c.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterCategory === c.value ? c.color + ' border-current' : 'bg-background text-muted-foreground border-border hover:border-foreground/30'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Visual timeline */}
        <div className="relative">
          {visibleEvents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">No events yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add your first event to start building the timeline</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button size="sm" className="gap-1.5" onClick={openNewEvent}>
                    <Plus className="h-4 w-4" /> Add First Event
                  </Button>
                  {assistantPanel && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() =>
                        assistantPanel.openAssistant(
                          `Help me build a practical wedding-day timeline for "${selectedTimeline.title}" with prep, ceremony, photos, reception, and wrap-up.`,
                        )
                      }
                    >
                      Create with AI
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="relative ml-4 border-l-2 border-primary/20 pl-6 space-y-1">
                {visibleEvents.filter(ev => !filterCategory || ev.category === filterCategory).map((ev, i, filteredEvents) => (
                  <div
                    key={ev.id}
                    draggable={pendingDeleteIds.size === 0}
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                    onDragEnd={() => {
                      if (dragIndex !== null && dragOverIndex !== null) {
                        const fromEvent = filteredEvents[dragIndex];
                        const toEvent = filteredEvents[dragOverIndex];
                        if (fromEvent && toEvent) void handleDrop(fromEvent.id, toEvent.id);
                      }
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
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
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-card-foreground">{ev.title}</p>
                            {getCategoryMeta(ev.category) && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryMeta(ev.category)!.color}`}>
                                {getCategoryMeta(ev.category)!.label}
                              </span>
                            )}
                          </div>
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label>Time</Label>
                  <Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Title</Label>
                  <Input placeholder="e.g. Ceremony start" value={eventTitle} onChange={e => setEventTitle(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea placeholder="Additional details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Category</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setEventCategory(null)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${!eventCategory ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-border'}`}
                  >
                    None
                  </button>
                  {EVENT_CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setEventCategory(c.value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${eventCategory === c.value ? c.color + ' border-current' : 'bg-background text-muted-foreground border-border'}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
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
                  <Button size="icon" variant="outline" disabled={!selectedTimelineShareActive} onClick={() => copyToClipboard(`${baseUrl}/timeline/share/${selectedTimeline.share_token}`)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="shrink-0 text-primary hover:text-primary hover:bg-primary/10" disabled={!selectedTimelineShareActive} asChild={selectedTimelineShareActive}>
                    {selectedTimelineShareActive ? (
                      <a href={`https://wa.me/?text=${encodeURIComponent(`Here's the wedding timeline for "${selectedTimeline.title}":\n${baseUrl}/timeline/share/${selectedTimeline.share_token}`)}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    ) : (
                      <span>
                        <MessageCircle className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant={selectedTimelineShareActive ? 'success' : 'outline'}>
                    {selectedTimelineShareActive ? 'Link active' : 'Link inactive'}
                  </Badge>
                  {selectedTimeline.share_expires_at && (
                    <span className="text-xs text-muted-foreground">
                      Expires {new Date(selectedTimeline.share_expires_at).toLocaleDateString()}
                    </span>
                  )}
                  {typeof selectedTimeline.share_access_count === 'number' && (
                    <span className="text-xs text-muted-foreground">
                      {selectedTimeline.share_access_count} public open{selectedTimeline.share_access_count === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Anyone with this link sees the full timeline</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" className="gap-2" onClick={() => void refreshFullTimelineLink()}>
                    <RotateCw className="h-4 w-4" />
                    Refresh Link
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => void revokeFullTimelineLink()}
                    disabled={!selectedTimelineShareActive}
                  >
                    <ShieldOff className="h-4 w-4" />
                    Revoke Link
                  </Button>
                </div>
              </div>

              {/* Per-person links */}
              {shareLinks.length > 0 && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Individual Links</Label>
                  <div className="space-y-3 mt-1.5">
                    {shareLinks.map(sl => {
                      const link = `${baseUrl}/timeline/share/${sl.share_token}`;
                      const shareIsActive = isTokenActive(sl.expires_at, sl.revoked_at);
                      const roleMeta = getVendorRole(sl.vendor_role);
                      const waText = encodeURIComponent(`Hi ${sl.assignee_name}! Here's your timeline for "${selectedTimeline.title}":\n${link}`);
                      return (
                        <div key={sl.id} className="rounded-lg border border-border p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="shrink-0 gap-1">
                              {roleMeta && <span>{roleMeta.icon}</span>}
                              {sl.assignee_name}
                            </Badge>
                            {roleMeta && (
                              <span className="text-xs text-muted-foreground">{roleMeta.label}</span>
                            )}
                            <div className="flex-1" />
                            <Badge variant={shareIsActive ? 'success' : 'outline'} className="shrink-0">
                              {shareIsActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <select
                              className="text-xs border border-input rounded-md px-2 py-1 bg-background"
                              value={sl.vendor_role || ''}
                              onChange={async (e) => {
                                const role = e.target.value || null;
                                await supabase.from('timeline_share_links').update({ vendor_role: role } as any).eq('id', sl.id);
                                loadShareLinks(selectedTimeline.id);
                              }}
                            >
                              <option value="">Set role…</option>
                              {VENDOR_ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              key={sl.id + '-email'}
                              placeholder="Email for reminders…"
                              defaultValue={sl.email || ''}
                              className="text-xs flex-1"
                              type="email"
                              onBlur={async (e) => {
                                const email = e.target.value.trim() || null;
                                if (email !== (sl.email || null)) {
                                  await supabase.from('timeline_share_links').update({ email } as any).eq('id', sl.id);
                                  loadShareLinks(selectedTimeline.id);
                                }
                              }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {sl.expires_at
                              ? `Expires ${new Date(sl.expires_at).toLocaleDateString()}`
                              : 'No expiry set'}
                            {typeof sl.access_count === 'number' ? ` • ${sl.access_count} open${sl.access_count === 1 ? '' : 's'}` : ''}
                            {sl.last_accessed_at ? ` • Last opened ${new Date(sl.last_accessed_at).toLocaleString()}` : ''}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input readOnly value={link} className="text-xs flex-1" />
                            <Button size="icon" variant="outline" className="shrink-0 h-8 w-8" disabled={!shareIsActive} onClick={() => copyToClipboard(link)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="outline" className="shrink-0 h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" disabled={!shareIsActive} asChild={shareIsActive}>
                              {shareIsActive ? (
                                <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <span>
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </Button>
                            <Button size="icon" variant="outline" className="shrink-0 h-8 w-8" onClick={() => void refreshAssigneeShareLink(sl)}>
                              <RotateCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="shrink-0 h-8 w-8 text-destructive hover:text-destructive"
                              disabled={!shareIsActive}
                              onClick={() => void revokeAssigneeShareLink(sl)}
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xs">
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-background via-background to-muted/30 shadow-card">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.95fr] lg:p-8">
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-info">Timeline Workspace</p>
                <InfoTip content="Build the wedding-day flow, keep timings clear, and share either the full schedule or role-specific views with the right people." />
              </div>
              <h1 className="workspace-h1 mt-2">Build the day-of flow without overwhelm</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Start with one schedule, then refine timings, roles, and share links once the shape of the day is clear.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#d9e5f4] bg-[#f4f8fd]/90 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Live timelines</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{instances.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {instances.length === 0 ? 'No wedding schedule built yet' : 'Working versions ready to open'}
                </p>
              </div>
              <div className="rounded-2xl border border-[#d9ead7] bg-[#f4fbf3]/90 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Templates</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{templates.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {templates.length === 0 ? 'No reusable wedding flow yet' : 'Reusable starting points available'}
                </p>
              </div>
              <div className="rounded-2xl border border-[#f0dfc5] bg-[#fff8ec]/95 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Next focus</p>
                <p className="mt-2 text-sm font-medium text-foreground">{timelineHeroAction}</p>
                <p className="mt-1 text-xs text-muted-foreground">Best next move right now.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background/85 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Start the schedule</p>
              <InfoTip content="Start blank, use a saved template, or ask the assistant for a first draft. You can refine timings later." />
            </div>
            <div className="mt-4 space-y-3">
              <Button
                className="w-full justify-start gap-2"
                onClick={() => { setNewIsTemplate(false); setFromTemplateId(null); setCreateOpen(true); }}
              >
                <Plus className="h-4 w-4" />
                Create manually
              </Button>
              <details className="rounded-2xl border border-border/70 bg-background/70 p-3">
                <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Template and AI tools
                </summary>
                <div className="mt-3 space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  if (templates.length > 0) {
                    setNewIsTemplate(false);
                    setFromTemplateId(templates[0].id);
                    setCreateOpen(true);
                    return;
                  }
                  setNewIsTemplate(true);
                  setFromTemplateId(null);
                  setCreateOpen(true);
                }}
              >
                <FileText className="h-4 w-4" />
                  {templates.length > 0 ? 'Start from template' : 'Create your first template'}
              </Button>
              {assistantPanel && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() =>
                    assistantPanel.openAssistant(
                      'Help me build a full wedding-day timeline with getting ready, ceremony, photos, reception, and closing flow.',
                    )
                  }
                >
                  Plan with AI
                </Button>
              )}
                </div>
              </details>
              <div className="semantic-surface-info rounded-2xl border p-4">
                <p className="text-sm font-medium text-foreground">
                  {templates.length > 0 ? 'Templates make repeat planning faster' : 'A clean first draft is enough to get moving'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {templates.length > 0
                    ? 'Copy a reusable flow, then adjust the timings.'
                    : 'Start simple, then refine later.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/70 shadow-card">
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-info">Live timelines</p>
                <h2 className="workspace-h2 mt-2">Open the working schedule</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep the active wedding-day timelines in focus. Templates stay available below when you need them.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {instances.length} live
              </Badge>
            </div>

            {instances.length === 0 ? (
              <Card className="border-dashed shadow-none">
                <CardContent className="flex flex-col items-start gap-5 p-6">
                  <div>
                    <p className="text-lg font-semibold text-foreground">No live timeline yet</p>
                    <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                      Start with one workable schedule. You can refine times, copy from templates, and add share links after the shape of the day is clear.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="gap-1.5" onClick={() => { setNewIsTemplate(false); setFromTemplateId(null); setCreateOpen(true); }}>
                      <Plus className="h-4 w-4" /> Create Blank Timeline
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        if (templates.length > 0) {
                          const firstTemplate = templates[0];
                          if (firstTemplate) {
                            selectTimeline(firstTemplate);
                          }
                          return;
                        }
                        setNewIsTemplate(true);
                        setFromTemplateId(null);
                        setCreateOpen(true);
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      {templates.length > 0 ? 'Open template library' : 'Create Template'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {instances.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card
                      interactive
                      className="group relative"
                    >
                      <button
                        type="button"
                        className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => selectTimeline(t)}
                      >
                        <span className="sr-only">Open {t.title}</span>
                      </button>
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
                      <CardContent className="relative z-10 pb-4 pointer-events-none [&_button]:pointer-events-auto">
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
          </CardContent>
        </Card>

        <details className="rounded-3xl border border-border/70 bg-background p-5 shadow-card">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Template library</p>
                <h3 className="workspace-h3 mt-2">Reusable wedding-day structures</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open this when you want to save a reusable flow or apply a saved structure to a new wedding day.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {templates.length} template{templates.length === 1 ? '' : 's'}
              </div>
            </div>
          </summary>
          <div className="mt-5">
            {templates.length === 0 ? (
              <Card className="border-dashed shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">No templates yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Create a reusable timeline structure.</p>
                  <Button size="sm" className="mt-4 gap-1.5" onClick={() => { setNewIsTemplate(true); setFromTemplateId(null); setCreateOpen(true); }}>
                    <Plus className="h-4 w-4" /> Create Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card
                      interactive
                      className="group relative"
                    >
                      <button
                        type="button"
                        className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => selectTimeline(t)}
                      >
                        <span className="sr-only">Open {t.title} template</span>
                      </button>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            {t.title}
                            <Badge variant="secondary" className="text-[10px]">Template</Badge>
                          </CardTitle>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10 pb-4 pointer-events-none [&_button]:pointer-events-auto">
                        <div className="flex items-center justify-between">
                          <Button
                            variant="outline" size="sm" className="text-xs gap-1"
                            onClick={e => {
                              e.stopPropagation();
                              openApplyTemplate(t);
                            }}
                          >
                            <Copy className="h-3 w-3" /> Apply Template
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
          </div>
        </details>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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

      {/* Apply Template dialog */}
      <Dialog open={applyTemplateOpen} onOpenChange={setApplyTemplateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Apply Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {selectedTemplateForApply && (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Template</p>
                <p className="font-semibold text-foreground">{selectedTemplateForApply.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{templatePreviewEvents.length} events</p>
              </div>
            )}
            <div>
              <Label>Timeline Name</Label>
              <Input placeholder="e.g. Sarah & James Wedding" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Wedding Date</Label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div>
                <Label>Ceremony Start Time</Label>
                <Input type="time" value={ceremonyCenterTime} onChange={e => setCeremonyCenterTime(e.target.value)} />
              </div>
            </div>

            {/* Preview of recalculated times */}
            {templatePreviewEvents.length > 0 && newDate && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Preview (auto-calculated)</p>
                <div className="rounded-lg border border-border bg-muted/20 max-h-48 overflow-y-auto">
                  {(() => {
                    const anchor = templatePreviewEvents.find(e => e.category === 'ceremony') || templatePreviewEvents[0];
                    const [aH, aM] = anchor.event_time.split(':').map(Number);
                    const [tH, tM] = ceremonyCenterTime.split(':').map(Number);
                    const offset = (tH * 60 + tM) - (aH * 60 + aM);
                    return templatePreviewEvents.map((ev, i) => {
                      const [h, m] = ev.event_time.split(':').map(Number);
                      const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + offset));
                      const nH = String(Math.floor(total / 60)).padStart(2, '0');
                      const nM = String(total % 60).padStart(2, '0');
                      const catMeta = getCategoryMeta(ev.category);
                      return (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0">
                          <span className="text-sm font-mono font-semibold text-primary w-16 shrink-0">
                            {formatTime(`${nH}:${nM}`)}
                          </span>
                          <span className="text-sm text-foreground flex-1">{ev.title}</span>
                          {catMeta && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catMeta.color}`}>
                              {catMeta.label}
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Times are offset based on the first <strong>Ceremony</strong> event in the template
                </p>
              </div>
            )}

            <Button className="w-full" onClick={handleApplyTemplate} disabled={!newTitle.trim() || !newDate || applyLoading}>
              <Check className="h-4 w-4 mr-1.5" /> {applyLoading ? 'Creating…' : 'Create Wedding Timeline'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
