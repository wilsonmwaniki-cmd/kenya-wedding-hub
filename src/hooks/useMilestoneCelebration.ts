import { useEffect, useRef, useState } from 'react';

export const WORKSPACE_MILESTONE_EVENT = 'zania:workspace-milestone-reached';

export interface WorkspaceMilestoneEventDetail {
  entityKey: string;
  completedCount: number;
  previousCount: number;
  milestoneLabel: string;
}

interface UseMilestoneCelebrationOptions {
  entityKey: string | null | undefined;
  completedCount: number;
  milestoneLabels: string[];
  onReached?: (detail: WorkspaceMilestoneEventDetail) => void;
  durationMs?: number;
}

export function useMilestoneCelebration({
  entityKey,
  completedCount,
  milestoneLabels,
  onReached,
  durationMs = 1400,
}: UseMilestoneCelebrationOptions) {
  const previousCountsRef = useRef(new Map<string, number>());
  const callbackRef = useRef(onReached);
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [celebratingEntityKey, setCelebratingEntityKey] = useState<string | null>(null);

  callbackRef.current = onReached;

  useEffect(() => {
    if (!entityKey) return;

    const previousCount = previousCountsRef.current.get(entityKey);
    previousCountsRef.current.set(entityKey, completedCount);

    // Hydration and entity switches establish a baseline; they are not milestones.
    if (previousCount === undefined || completedCount <= previousCount) return;

    const milestoneLabel = milestoneLabels[Math.max(0, completedCount - 1)] ?? 'Planning milestone';
    const detail: WorkspaceMilestoneEventDetail = {
      entityKey,
      completedCount,
      previousCount,
      milestoneLabel,
    };

    window.dispatchEvent(new CustomEvent<WorkspaceMilestoneEventDetail>(WORKSPACE_MILESTONE_EVENT, { detail }));
    callbackRef.current?.(detail);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setCelebratingEntityKey(entityKey);
    timeoutRef.current = window.setTimeout(() => {
      setCelebratingEntityKey((current) => current === entityKey ? null : current);
      timeoutRef.current = null;
    }, durationMs);
  }, [completedCount, durationMs, entityKey, milestoneLabels]);

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  return {
    celebrating: Boolean(entityKey && celebratingEntityKey === entityKey),
  };
}
