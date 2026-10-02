type ErrorContextLike = {
  context?: Response;
  message?: string;
};

type NormalizedInvokeError = {
  statusCode: number | null;
  message: string;
  payload: Record<string, unknown> | null;
};

function normalizePayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return raw.trim() ? { error: raw.trim() } : null;
  }
}

export async function normalizeInvokeError(
  error: unknown,
  fallbackMessage: string,
): Promise<NormalizedInvokeError> {
  const invokeError = (error ?? {}) as ErrorContextLike;
  const response = invokeError.context;

  if (response instanceof Response) {
    const raw = await response.text();
    const payload = normalizePayload(raw);
    const payloadMessage =
      (typeof payload?.error === 'string' && payload.error)
      || (typeof payload?.message === 'string' && payload.message)
      || (typeof payload?.details === 'string' && payload.details)
      || null;

    return {
      statusCode: response.status,
      message: payloadMessage || fallbackMessage,
      payload,
    };
  }

  return {
    statusCode: null,
    message: invokeError.message || fallbackMessage,
    payload: null,
  };
}

export function describeBillingError(
  phase: 'checkout_start' | 'checkout_sync',
  statusCode: number | null,
  message: string,
) {
  if (statusCode === 401) {
    return 'Your session expired. Sign in again, then retry the upgrade.';
  }

  if (statusCode === 403) {
    return phase === 'checkout_start'
      ? 'This account cannot purchase this upgrade for the current workspace.'
      : 'This account can no longer activate this checkout for the current workspace.';
  }

  if (statusCode === 404) {
    return phase === 'checkout_start'
      ? 'We could not find the account or billing item needed to start checkout.'
      : 'We could not find the workspace or billing record needed to finish activation.';
  }

  if (statusCode === 500 && /not fully configured|not configured/i.test(message)) {
    return phase === 'checkout_start'
      ? 'Billing is not fully configured yet. Please contact the team before retrying checkout.'
      : 'Payment may have completed, but billing activation is not fully configured yet. Please contact the team.';
  }

  if (/Failed to send a request to the Edge Function/i.test(message)) {
    return phase === 'checkout_start'
      ? 'We could not reach billing right now. Your card was not charged. Please try again in a moment.'
      : 'We could not reach billing activation right now. If payment completed, refresh shortly or contact the team.';
  }

  return message;
}

export function describeAiInvokeError(statusCode: number | null, message: string) {
  if (statusCode === 401) {
    return 'Your session expired for the AI workspace. Please sign in again and retry.';
  }

  if (/OpenAI credits exhausted|insufficient_quota/i.test(message)) {
    return 'Zania’s AI service is temporarily unavailable. Your workspace access is active; this is not a subscription issue. Please try again later.';
  }

  if (statusCode === 503 || /AI service unavailable/i.test(message)) {
    return 'Zania’s AI service is temporarily unavailable. Your workspace access is not the issue. Please try again later.';
  }

  if (statusCode === 402) {
    return 'AI access is not enabled for this workspace yet. Upgrade or switch to a workspace with AI access.';
  }

  if (statusCode === 403) {
    return /disabled/i.test(message)
      ? 'The AI assistant is temporarily disabled for this plan. Your subscription is not the issue.'
      : 'AI access is not enabled for this workspace yet. Upgrade or switch to a workspace with AI access.';
  }

  if (statusCode === 429) {
    if (/fair-use allowance|included.*allowance/i.test(message)) {
      return 'This account has used its included Zania Assistant allowance for the month. It refreshes next month.';
    }
    return 'This workspace has reached its AI limit for the month. Try again later or raise the limit in admin controls.';
  }

  if (statusCode === 500 && /OPENAI_API_KEY|not configured/i.test(message)) {
    return 'The AI assistant is not fully configured yet. Please contact the team before retrying.';
  }

  if (/Failed to send a request to the Edge Function/i.test(message)) {
    return 'Could not reach the AI function right now. Please try again in a few moments.';
  }

  return message;
}
