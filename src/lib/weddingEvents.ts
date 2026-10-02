import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type WeddingEvent = {
  id: string;
  weddingId: string;
  name: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  location: string | null;
  notes: string | null;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type WeddingEventRow = {
  id: string;
  wedding_id: string;
  name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  location: string | null;
  notes: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type WeddingEventInsert = Omit<WeddingEventRow, 'id' | 'created_at' | 'updated_at' | 'archived_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
};

type WeddingEventUpdate = Partial<WeddingEventInsert>;

type WeddingEventsDatabase = {
  public: {
    Tables: {
      wedding_events: {
        Row: WeddingEventRow;
        Insert: WeddingEventInsert;
        Update: WeddingEventUpdate;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      set_primary_wedding_event: {
        Args: {
          target_wedding_id: string;
          target_event_id: string;
        };
        Returns: WeddingEventRow;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

const weddingEventsClient = supabase as unknown as SupabaseClient<WeddingEventsDatabase>;

export type CreateWeddingEventInput = {
  weddingId: string;
  name: string;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  location?: string | null;
  notes?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
};

export type UpdateWeddingEventInput = Partial<Omit<CreateWeddingEventInput, 'weddingId' | 'isPrimary'>>;

export type WeddingEventDateRange = {
  startDate: string;
  endDate: string;
};

const normalizeOptionalText = (value: string | null | undefined) => value?.trim() || null;

export function normalizeWeddingEventName(value: string) {
  const name = value.trim();
  if (!name) throw new Error('Enter an event name.');
  return name;
}

export function mapWeddingEvent(row: WeddingEventRow): WeddingEvent {
  return {
    id: row.id,
    weddingId: row.wedding_id,
    name: row.name,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    venueName: row.venue_name,
    location: row.location,
    notes: row.notes,
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

export function sortWeddingEvents(events: WeddingEvent[]) {
  return [...events].sort((left, right) =>
    left.eventDate.localeCompare(right.eventDate)
    || left.sortOrder - right.sortOrder
    || left.name.localeCompare(right.name)
    || left.id.localeCompare(right.id),
  );
}

export function getWeddingEventDateRange(events: WeddingEvent[]): WeddingEventDateRange | null {
  const activeEvents = sortWeddingEvents(events.filter((event) => !event.archivedAt));
  if (activeEvents.length === 0) return null;

  return {
    startDate: activeEvents[0].eventDate,
    endDate: activeEvents[activeEvents.length - 1].eventDate,
  };
}

export function getNextWeddingEvent(events: WeddingEvent[], today: string) {
  return sortWeddingEvents(events).find(
    (event) => !event.archivedAt && event.eventDate >= today,
  ) ?? null;
}

export async function listWeddingEvents(weddingId: string, options?: { includeArchived?: boolean }) {
  let query = weddingEventsClient
    .from('wedding_events')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('event_date', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (!options?.includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as WeddingEventRow[]).map(mapWeddingEvent);
}

export async function createWeddingEvent(input: CreateWeddingEventInput) {
  const payload = {
    wedding_id: input.weddingId,
    name: normalizeWeddingEventName(input.name),
    event_date: input.eventDate,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
    venue_name: normalizeOptionalText(input.venueName),
    location: normalizeOptionalText(input.location),
    notes: normalizeOptionalText(input.notes),
    is_primary: input.isPrimary ?? false,
    sort_order: input.sortOrder ?? 0,
  };

  const { data, error } = await weddingEventsClient
    .from('wedding_events')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return mapWeddingEvent(data as WeddingEventRow);
}

export async function updateWeddingEvent(
  weddingId: string,
  eventId: string,
  input: UpdateWeddingEventInput,
) {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.name = normalizeWeddingEventName(input.name);
  if (input.eventDate !== undefined) payload.event_date = input.eventDate;
  if (input.startTime !== undefined) payload.start_time = input.startTime;
  if (input.endTime !== undefined) payload.end_time = input.endTime;
  if (input.venueName !== undefined) payload.venue_name = normalizeOptionalText(input.venueName);
  if (input.location !== undefined) payload.location = normalizeOptionalText(input.location);
  if (input.notes !== undefined) payload.notes = normalizeOptionalText(input.notes);
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

  if (Object.keys(payload).length === 0) {
    throw new Error('No event changes were provided.');
  }

  const { data, error } = await weddingEventsClient
    .from('wedding_events')
    .update(payload)
    .eq('wedding_id', weddingId)
    .eq('id', eventId)
    .is('archived_at', null)
    .select('*')
    .single();

  if (error) throw error;
  return mapWeddingEvent(data as WeddingEventRow);
}

export async function setPrimaryWeddingEvent(weddingId: string, eventId: string) {
  const { data, error } = await weddingEventsClient.rpc('set_primary_wedding_event', {
    target_wedding_id: weddingId,
    target_event_id: eventId,
  });

  if (error) throw error;
  return mapWeddingEvent(data as WeddingEventRow);
}

export async function archiveWeddingEvent(weddingId: string, eventId: string) {
  const { data, error } = await weddingEventsClient
    .from('wedding_events')
    .update({ archived_at: new Date().toISOString() })
    .eq('wedding_id', weddingId)
    .eq('id', eventId)
    .is('archived_at', null)
    .select('*')
    .single();

  if (error) throw error;
  return mapWeddingEvent(data as WeddingEventRow);
}
