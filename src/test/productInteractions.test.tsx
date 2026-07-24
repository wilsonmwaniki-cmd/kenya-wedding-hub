import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeferredDelete } from '@/hooks/useDeferredDelete';
import {
  useMilestoneCelebration,
  WORKSPACE_MILESTONE_EVENT,
  type WorkspaceMilestoneEventDetail,
} from '@/hooks/useMilestoneCelebration';

describe('product interaction workflows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('cancels a deferred mutation when the user chooses Undo', async () => {
    const commit = vi.fn(async () => undefined);
    const onUndo = vi.fn();
    const { result } = renderHook(() => useDeferredDelete({ delayMs: 1000 }));

    act(() => {
      result.current.scheduleDelete({
        id: 'guest-1',
        title: 'Guest removed',
        commit,
        onUndo,
      });
    });

    expect(result.current.pendingIds.has('guest-1')).toBe(true);

    act(() => {
      result.current.undo('guest-1', onUndo);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(commit).not.toHaveBeenCalled();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(result.current.pendingIds.has('guest-1')).toBe(false);
  });

  it('emits a milestone only when completed progress increases', () => {
    const milestoneDetails: WorkspaceMilestoneEventDetail[] = [];
    const listener = (event: Event) => {
      milestoneDetails.push((event as CustomEvent<WorkspaceMilestoneEventDetail>).detail);
    };
    window.addEventListener(WORKSPACE_MILESTONE_EVENT, listener);

    const { rerender } = renderHook(
      ({ completedCount }) => useMilestoneCelebration({
        entityKey: 'vendor-1',
        completedCount,
        milestoneLabels: ['First follow-up complete', 'Payment milestone complete'],
      }),
      { initialProps: { completedCount: 0 } },
    );

    expect(milestoneDetails).toHaveLength(0);

    act(() => {
      rerender({ completedCount: 1 });
      rerender({ completedCount: 1 });
    });

    expect(milestoneDetails).toEqual([
      expect.objectContaining({
        entityKey: 'vendor-1',
        completedCount: 1,
        previousCount: 0,
        milestoneLabel: 'First follow-up complete',
      }),
    ]);

    window.removeEventListener(WORKSPACE_MILESTONE_EVENT, listener);
  });

  it('announces the milestone that actually changed when progress is out of order', () => {
    const onReached = vi.fn();
    const { rerender } = renderHook(
      ({ completedCount, completedMilestoneLabels }) => useMilestoneCelebration({
        entityKey: 'vendor-1',
        completedCount,
        milestoneLabels: ['Research', 'Booking', 'Second payment', 'Closure'],
        completedMilestoneLabels,
        onReached,
      }),
      {
        initialProps: {
          completedCount: 2,
          completedMilestoneLabels: ['Research', 'Second payment'],
        },
      },
    );

    act(() => {
      rerender({
        completedCount: 3,
        completedMilestoneLabels: ['Research', 'Booking', 'Second payment'],
      });
    });

    expect(onReached).toHaveBeenCalledWith(expect.objectContaining({
      milestoneLabel: 'Booking',
      previousCount: 2,
      completedCount: 3,
    }));
  });
});
