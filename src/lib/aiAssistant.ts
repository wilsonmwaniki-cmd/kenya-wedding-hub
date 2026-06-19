import { supabase } from '@/integrations/supabase/client';
import { describeAiInvokeError, normalizeInvokeError } from '@/lib/invokeErrors';

export interface AiAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PendingWriteAction {
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  destructive: boolean;
}

export interface AiUsageStatus {
  audience: string;
  monthly_message_cap: number;
  messages_used: number;
  remaining_messages: number;
  month_start: string;
  ai_enabled: boolean;
  add_on_separate: boolean;
  add_on_lookup_key: string | null;
  add_on_annual_lookup_key: string | null;
}

export interface WeddingAiInvokeParams {
  messages: AiAssistantMessage[];
  selectedClientId?: string | null;
  allowWriteActions?: boolean;
  confirmedActions?: PendingWriteAction[];
  page?: string | null;
  surface?: string | null;
  contextSource?: string | null;
  entityId?: string | null;
  starterPrompt?: string | null;
}

export interface WeddingAiInvokeResult {
  content: string;
  usage: AiUsageStatus | null;
  pendingActions: PendingWriteAction[];
  assistantRole: string | null;
}

export class WeddingAiInvokeError extends Error {
  statusCode: number | null;
  usage: AiUsageStatus | null;
  requiresUpgrade: boolean;
  raw: unknown;

  constructor(
    message: string,
    options?: {
      statusCode?: number | null;
      usage?: AiUsageStatus | null;
      raw?: unknown;
    },
  ) {
    super(message);
    this.name = 'WeddingAiInvokeError';
    this.statusCode = options?.statusCode ?? null;
    this.usage = options?.usage ?? null;
    this.requiresUpgrade = this.statusCode === 402 || this.statusCode === 403;
    this.raw = options?.raw ?? null;
  }
}

export async function invokeWeddingAiChat(
  params: WeddingAiInvokeParams,
): Promise<WeddingAiInvokeResult> {
  const { data, error } = await supabase.functions.invoke('wedding-ai-chat', {
    body: {
      messages: params.messages,
      selectedClientId: params.selectedClientId ?? null,
      allowWriteActions: params.allowWriteActions ?? false,
      confirmedActions: params.confirmedActions ?? [],
      page: params.page ?? null,
      surface: params.surface ?? null,
      contextSource: params.contextSource ?? null,
      entityId: params.entityId ?? null,
      starterPrompt: params.starterPrompt ?? null,
    },
  });

  if (error) {
    const normalized = await normalizeInvokeError(error, 'Request failed');
    const usage = (normalized.payload?.usage ?? null) as AiUsageStatus | null;
    const fallbackError = describeAiInvokeError(normalized.statusCode, normalized.message);

    throw new WeddingAiInvokeError(fallbackError, {
      statusCode: normalized.statusCode,
      usage,
      raw: normalized.payload ?? error,
    });
  }

  return {
    content: data?.content || 'Sorry, I could not generate a response.',
    usage: data?.usage ?? null,
    pendingActions: Array.isArray(data?.pendingActions) ? (data.pendingActions as PendingWriteAction[]) : [],
    assistantRole: typeof data?.assistantRole === 'string' ? data.assistantRole : null,
  };
}
