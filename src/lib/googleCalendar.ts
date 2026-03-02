/**
 * Generate a Google Calendar "Add Event" URL.
 */
export function buildGoogleCalendarUrl({
  title,
  date,
  description,
  location,
}: {
  title: string;
  date?: string | null; // YYYY-MM-DD
  description?: string | null;
  location?: string | null;
}): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams();
  params.set('text', title);

  if (date) {
    // All-day event: use date format YYYYMMDD/YYYYMMDD (next day)
    const start = date.replace(/-/g, '');
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    const end = d.toISOString().slice(0, 10).replace(/-/g, '');
    params.set('dates', `${start}/${end}`);
  }

  if (description) params.set('details', description);
  if (location) params.set('location', location);

  return `${base}&${params.toString()}`;
}
