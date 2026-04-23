import { supabase } from '@/integrations/supabase/client';

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

function normalizeErrorPayload(rawError: string) {
  try {
    const parsed = JSON.parse(rawError);
    if (parsed && typeof parsed === 'object') {
      const primaryMessage =
        typeof parsed.error === 'string'
          ? parsed.error
          : typeof parsed.message === 'string'
            ? parsed.message
            : typeof parsed.details === 'string'
              ? parsed.details
              : null;

      return primaryMessage ? { ...parsed, error: primaryMessage } : parsed;
    }

    return parsed;
  } catch {
    return rawError.trim() ? { error: rawError.trim() } : null;
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
    let statusCode: number | null = null;
    let usage: AiUsageStatus | null = null;
    let fallbackError = error.message || 'Request failed';
    let parsedError: any = null;

    const maybeContext = (error as { context?: Response }).context;
    if (maybeContext instanceof Response) {
      statusCode = maybeContext.status;
      const rawError = await maybeContext.text();
      parsedError = normalizeErrorPayload(rawError);
      usage = parsedError?.usage ?? null;
      fallbackError =
        parsedError?.error ||
        parsedError?.message ||
        parsedError?.details ||
        (rawError.trim()
          ? rawError.trim()
          : `Request failed with status ${maybeContext.status}${maybeContext.statusText ? ` (${maybeContext.statusText})` : ''}`);
    } else if (fallbackError === 'Failed to send a request to the Edge Function') {
      fallbackError = 'Could not reach the AI function. Please try again in a few moments.';
    }

    throw new WeddingAiInvokeError(fallbackError, {
      statusCode,
      usage,
      raw: parsedError ?? error,
    });
  }

  return {
    content: data?.content || 'Sorry, I could not generate a response.',
    usage: data?.usage ?? null,
    pendingActions: Array.isArray(data?.pendingActions) ? (data.pendingActions as PendingWriteAction[]) : [],
    assistantRole: typeof data?.assistantRole === 'string' ? data.assistantRole : null,
  };
}
