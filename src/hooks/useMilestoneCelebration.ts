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
  completedMilestoneLabels?: string[];
  onReached?: (detail: WorkspaceMilestoneEventDetail) => void;
  durationMs?: number;
}

export function useMilestoneCelebration({
  entityKey,
  completedCount,
  milestoneLabels,
  completedMilestoneLabels,
  onReached,
  durationMs = 1400,
}: UseMilestoneCelebrationOptions) {
  const previousProgressRef = useRef(new Map<string, { count: number; labels: string[] }>());
  const callbackRef = useRef(onReached);
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [celebratingEntityKey, setCelebratingEntityKey] = useState<string | null>(null);

  callbackRef.current = onReached;

  useEffect(() => {
    if (!entityKey) return;

    const currentLabels = completedMilestoneLabels ?? milestoneLabels.slice(0, completedCount);
    const previousProgress = previousProgressRef.current.get(entityKey);
    previousProgressRef.current.set(entityKey, { count: completedCount, labels: currentLabels });

    // Hydration and entity switches establish a baseline; they are not milestones.
    if (!previousProgress || completedCount <= previousProgress.count) return;

    const milestoneLabel = currentLabels.find((label) => !previousProgress.labels.includes(label))
      ?? milestoneLabels[Math.max(0, completedCount - 1)]
      ?? 'Planning milestone';
    const detail: WorkspaceMilestoneEventDetail = {
      entityKey,
      completedCount,
      previousCount: previousProgress.count,
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
  }, [completedCount, completedMilestoneLabels, durationMs, entityKey, milestoneLabels]);

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  return {
    celebrating: Boolean(entityKey && celebratingEntityKey === entityKey),
  };
}
