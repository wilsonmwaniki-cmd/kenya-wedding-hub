import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';

function normalizeMemoryKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '-').slice(0, 120);
}

export function usePersistentAssistantDismissal(suggestionKey: string | null | undefined) {
  const { user } = useAuth();
  const { selectedClient } = usePlanner();
  const workspaceKey = selectedClient?.id ? `client:${selectedClient.id}` : 'personal';
  const memoryKey = suggestionKey ? normalizeMemoryKey(`nudge:${suggestionKey}`) : null;
  const storageKey = user?.id && memoryKey
    ? `zania:assistant-dismissal:${user.id}:${workspaceKey}:${memoryKey}`
    : null;
  const [dismissed, setDismissed] = useState(() => Boolean(
    storageKey && window.localStorage.getItem(storageKey),
  ));

  useEffect(() => {
    if (!storageKey || !memoryKey || !user?.id) {
      setDismissed(false);
      return;
    }

    let active = true;
    const locallyDismissed = Boolean(window.localStorage.getItem(storageKey));
    setDismissed(locallyDismissed);

    const loadRemoteMemory = async () => {
      const { data, error } = await supabase
        .from('ai_assistant_memories')
        .select('id')
        .eq('owner_user_id', user.id)
        .eq('workspace_key', workspaceKey)
        .eq('memory_type', 'dismissed_suggestion')
        .eq('memory_key', memoryKey)
        .maybeSingle();

      if (!active || error || !data) return;
      window.localStorage.setItem(storageKey, '1');
      setDismissed(true);
    };

    void loadRemoteMemory();
    return () => {
      active = false;
    };
  }, [memoryKey, storageKey, user?.id, workspaceKey]);

  const dismiss = async () => {
    if (!storageKey || !memoryKey || !user?.id) return;
    window.localStorage.setItem(storageKey, '1');
    setDismissed(true);

    await supabase.from('ai_assistant_memories').upsert({
      owner_user_id: user.id,
      workspace_key: workspaceKey,
      memory_type: 'dismissed_suggestion',
      memory_key: memoryKey,
      memory_value: { dismissed_at: new Date().toISOString() },
      source: 'workspace_nudge',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'owner_user_id,workspace_key,memory_type,memory_key',
    });
  };

  return { dismissed, dismiss };
}
