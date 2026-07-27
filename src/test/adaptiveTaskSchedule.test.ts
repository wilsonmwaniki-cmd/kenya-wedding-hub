import { describe, expect, it } from 'vitest';
import {
  getMaximumTimelineDays,
  resolveAdaptiveTaskDueDate,
  timelineLabelToOffsetDays,
} from '@/lib/adaptiveTaskSchedule';

describe('adaptive wedding task scheduling', () => {
  it('parses checklist timing labels into stable offsets', () => {
    expect(timelineLabelToOffsetDays('18 Months')).toBe(548);
    expect(timelineLabelToOffsetDays('4 Weeks')).toBe(28);
    expect(timelineLabelToOffsetDays('3 Days')).toBe(3);
    expect(timelineLabelToOffsetDays('Wedding Day')).toBe(0);
    expect(timelineLabelToOffsetDays('Post Wedding')).toBe(-7);
  });

  it('turns missed milestones into an ordered catch-up runway', () => {
    const common = {
      planningStartDate: '2026-01-01',
      weddingDate: '2026-07-01',
      maximumTimelineDays: 548,
    };

    const eighteenMonthTask = resolveAdaptiveTaskDueDate({
      ...common,
      timelineOffsetDays: 548,
    });
    const fourteenMonthTask = resolveAdaptiveTaskDueDate({
      ...common,
      timelineOffsetDays: timelineLabelToOffsetDays('14 Months'),
    });
    const eightMonthTask = resolveAdaptiveTaskDueDate({
      ...common,
      timelineOffsetDays: timelineLabelToOffsetDays('8 Months'),
    });

    expect(eighteenMonthTask).toBe('2026-01-03');
    expect(fourteenMonthTask! > eighteenMonthTask!).toBe(true);
    expect(eightMonthTask! > fourteenMonthTask!).toBe(true);
    expect(eightMonthTask! <= '2026-01-29').toBe(true);
  });

  it('keeps realistic future milestones anchored to the wedding date', () => {
    expect(resolveAdaptiveTaskDueDate({
      planningStartDate: '2026-01-01',
      weddingDate: '2026-07-01',
      timelineOffsetDays: 28,
    })).toBe('2026-06-03');

    expect(resolveAdaptiveTaskDueDate({
      planningStartDate: '2026-01-01',
      weddingDate: '2026-07-01',
      timelineOffsetDays: 0,
    })).toBe('2026-07-01');

    expect(resolveAdaptiveTaskDueDate({
      planningStartDate: '2026-01-01',
      weddingDate: '2026-07-01',
      timelineOffsetDays: -7,
    })).toBe('2026-07-08');
  });

  it('compresses safely even when the wedding is very close', () => {
    const dueDate = resolveAdaptiveTaskDueDate({
      planningStartDate: '2026-06-25',
      weddingDate: '2026-07-01',
      timelineOffsetDays: 548,
    });

    expect(dueDate).toBe('2026-06-27');
    expect(dueDate! < '2026-07-01').toBe(true);
  });

  it('uses the full checklist horizon when calculating catch-up order', () => {
    expect(getMaximumTimelineDays([28, 183, 426])).toBe(548);
    expect(getMaximumTimelineDays([730])).toBe(730);
  });
});
