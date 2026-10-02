const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_TIMELINE_DAYS = 548;

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function differenceInDays(later: Date, earlier: Date) {
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
}

export function timelineLabelToOffsetDays(timelineLabel: string | null | undefined) {
  if (!timelineLabel) return null;

  const monthsMatch = timelineLabel.match(/(\d+)\s*Months?/i);
  if (monthsMatch) return Math.round(Number(monthsMatch[1]) * 30.4375);

  const weeksMatch = timelineLabel.match(/(\d+)\s*Weeks?/i);
  if (weeksMatch) return Number(weeksMatch[1]) * 7;

  const daysMatch = timelineLabel.match(/(\d+)\s*Days?/i);
  if (daysMatch) return Number(daysMatch[1]);

  if (timelineLabel.toLowerCase() === 'wedding day') return 0;
  if (timelineLabel.toLowerCase() === 'post wedding') return -7;

  return null;
}

export function resolveAdaptiveTaskDueDate(input: {
  weddingDate: string | null | undefined;
  planningStartDate: string | null | undefined;
  timelineOffsetDays: number | null | undefined;
  maximumTimelineDays?: number;
}) {
  if (!input.weddingDate || !input.planningStartDate || input.timelineOffsetDays == null) {
    return null;
  }

  const weddingDate = parseDateOnly(input.weddingDate);
  const planningStartDate = parseDateOnly(input.planningStartDate);
  const planningWindowDays = differenceInDays(weddingDate, planningStartDate);
  const nominalDueDate = addDays(weddingDate, -input.timelineOffsetDays);

  if (planningWindowDays <= 0 || nominalDueDate >= planningStartDate) {
    return formatDateOnly(nominalDueDate);
  }

  const maximumTimelineDays = Math.max(
    input.maximumTimelineDays ?? DEFAULT_MAX_TIMELINE_DAYS,
    input.timelineOffsetDays,
    planningWindowDays + 1,
  );
  const catchUpDays = Math.min(
    28,
    Math.max(0, planningWindowDays - 1),
    Math.max(3, Math.round(planningWindowDays * 0.15)),
  );

  if (catchUpDays === 0) return formatDateOnly(planningStartDate);

  const graceDays = Math.min(2, catchUpDays);
  const missedWindowSpan = Math.max(1, maximumTimelineDays - planningWindowDays);
  const positionInCatchUp = Math.min(
    1,
    Math.max(0, (maximumTimelineDays - input.timelineOffsetDays) / missedWindowSpan),
  );
  const scheduledDaysFromStart = Math.round(
    graceDays + positionInCatchUp * (catchUpDays - graceDays),
  );

  return formatDateOnly(addDays(planningStartDate, scheduledDaysFromStart));
}

export function getMaximumTimelineDays(offsets: Array<number | null | undefined>) {
  return Math.max(
    DEFAULT_MAX_TIMELINE_DAYS,
    ...offsets.filter((offset): offset is number => offset != null),
  );
}
