import { supabase } from '@/integrations/supabase/client';
import type { AiAssistantMessage } from '@/lib/aiAssistant';

export type AssistantAudience = 'couple' | 'planner' | 'committee' | 'vendor';

export function getAssistantAudience(role?: string | null, plannerType?: string | null): AssistantAudience {
  if (role === 'vendor') return 'vendor';
  if (role === 'planner' && plannerType === 'committee') return 'committee';
  if (role === 'planner') return 'planner';
  return 'couple';
}

export async function loadLatestAssistantConversation(audience: AssistantAudience) {
  const { data: conversation, error: conversationError } = await (supabase as any)
    .from('assistant_conversations')
    .select('id')
    .eq('audience', audience)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversationError) throw conversationError;
  if (!conversation?.id) return { conversationId: null, messages: [] as AiAssistantMessage[] };

  const { data: rows, error: messagesError } = await (supabase as any)
    .from('assistant_messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(200);

  if (messagesError) throw messagesError;
  const messages = (rows ?? []).filter((row: any) => (
    (row.role === 'user' || row.role === 'assistant') && typeof row.content === 'string'
  )) as AiAssistantMessage[];

  return { conversationId: conversation.id as string, messages };
}
