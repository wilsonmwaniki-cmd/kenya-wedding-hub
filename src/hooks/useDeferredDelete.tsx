import { useEffect, useRef, useState } from 'react';

import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';

interface DeferredDeleteInput {
  id: string;
  title: string;
  description?: string;
  commit: () => Promise<void>;
  onCommit?: () => void | Promise<void>;
  onUndo?: () => void;
  onError?: (error: unknown) => void;
}

interface UseDeferredDeleteOptions {
  delayMs?: number;
}

export function useDeferredDelete({ delayMs = 6000 }: UseDeferredDeleteOptions = {}) {
  const { toast } = useToast();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const timersRef = useRef(new Map<string, ReturnType<typeof window.setTimeout>>());
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const removePendingId = (id: string) => {
    if (!mountedRef.current) return;
    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const undo = (id: string, onUndo?: () => void) => {
    const timer = timersRef.current.get(id);
    if (!timer) return;
    window.clearTimeout(timer);
    timersRef.current.delete(id);
    removePendingId(id);
    onUndo?.();
  };

  const scheduleDelete = ({ id, title, description, commit, onCommit, onUndo, onError }: DeferredDeleteInput) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) window.clearTimeout(existingTimer);

    setPendingIds((current) => new Set(current).add(id));

    const timer = window.setTimeout(async () => {
      timersRef.current.delete(id);
      try {
        await commit();
        await onCommit?.();
      } catch (error) {
        removePendingId(id);
        onError?.(error);
        toast({
          title: 'Could not complete that action',
          description: 'Nothing was removed. Please try again.',
          variant: 'destructive',
        });
        return;
      }
      removePendingId(id);
    }, delayMs);

    timersRef.current.set(id, timer);
    toast({
      title,
      description: description ?? 'You can undo this action for a few seconds.',
      action: (
        <ToastAction altText={`Undo ${title}`} onClick={() => undo(id, onUndo)}>
          Undo
        </ToastAction>
      ),
    });
  };

  return {
    pendingIds,
    scheduleDelete,
    undo,
  };
}
