import { describe, expect, it } from 'vitest';

import {
  getNextWeddingEvent,
  getWeddingEventDateRange,
  mapWeddingEvent,
  normalizeWeddingEventName,
  sortWeddingEvents,
  type WeddingEvent,
} from '@/lib/weddingEvents';

const event = (overrides: Partial<WeddingEvent>): WeddingEvent => ({
  id: 'event-1',
  weddingId: 'wedding-1',
  name: 'Ceremony',
  eventDate: '2026-08-24',
  startTime: null,
  endTime: null,
  venueName: null,
  location: null,
  notes: null,
  isPrimary: false,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  ...overrides,
});

describe('wedding events', () => {
  it('normalizes a user-defined event name without imposing a fixed vocabulary', () => {
    expect(normalizeWeddingEventName('  Anand Karaj  ')).toBe('Anand Karaj');
    expect(normalizeWeddingEventName('Walima')).toBe('Walima');
    expect(() => normalizeWeddingEventName('   ')).toThrow('Enter an event name.');
  });

  it('maps database columns without changing culturally meaningful names', () => {
    expect(mapWeddingEvent({
      id: 'event-1',
      wedding_id: 'wedding-1',
      name: 'Mehndi',
      event_date: '2026-08-22',
      start_time: '16:00:00',
      end_time: null,
      venue_name: 'Family home',
      location: 'Nairobi',
      notes: null,
      is_primary: true,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      archived_at: null,
    })).toMatchObject({
      weddingId: 'wedding-1',
      name: 'Mehndi',
      eventDate: '2026-08-22',
      isPrimary: true,
    });
  });

  it('orders different-day and same-day events deterministically', () => {
    const events = [
      event({ id: 'c', name: 'Dinner', eventDate: '2026-08-25', sortOrder: 0 }),
      event({ id: 'b', name: 'Reception', eventDate: '2026-08-24', sortOrder: 2 }),
      event({ id: 'a', name: 'Ceremony', eventDate: '2026-08-24', sortOrder: 1 }),
    ];

    expect(sortWeddingEvents(events).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('calculates the active wedding date range and ignores archived events', () => {
    const events = [
      event({ id: 'a', eventDate: '2026-08-23' }),
      event({ id: 'b', eventDate: '2026-08-25' }),
      event({ id: 'archived', eventDate: '2026-08-20', archivedAt: '2026-08-01T00:00:00.000Z' }),
    ];

    expect(getWeddingEventDateRange(events)).toEqual({
      startDate: '2026-08-23',
      endDate: '2026-08-25',
    });
  });

  it('finds the next active event without assuming one wedding day', () => {
    const events = [
      event({ id: 'past', eventDate: '2026-08-22' }),
      event({ id: 'today', eventDate: '2026-08-24', sortOrder: 1 }),
      event({ id: 'later', eventDate: '2026-08-25' }),
    ];

    expect(getNextWeddingEvent(events, '2026-08-24')?.id).toBe('today');
    expect(getNextWeddingEvent(events, '2026-08-26')).toBeNull();
  });
});
