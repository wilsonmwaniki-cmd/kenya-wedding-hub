import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import {
  invokeWeddingAiChat,
  WeddingAiInvokeError,
  type AiAssistantMessage,
  type AiUsageStatus,
  type PendingWriteAction,
} from '@/lib/aiAssistant';
import {
  getEntitlementDecision,
  type EntitlementDecision,
  type EntitlementFeature,
} from '@/lib/entitlements';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';

interface VendorListingAccess {
  id: string;
  is_approved: boolean;
  is_verified: boolean;
  verification_requested: boolean;
  subscription_status: string;
  subscription_expires_at: string | null;
}

export interface InlineAssistantOptions {
  feature: EntitlementFeature;
  page: string;
  surface: string;
  entityId?: string | null;
  contextSource?: string | null;
  conciergeContext?: string | null;
  initialMessages?: AiAssistantMessage[];
}

export interface InlineAssistantRunOptions {
  allowWriteActions?: boolean;
  entityId?: string | null;
  surface?: string | null;
  contextSource?: string | null;
  conciergeContext?: string | null;
}

export interface InlineAssistantState {
  decision: EntitlementDecision | null;
  canUseAssistant: boolean;
  loading: boolean;
  usageLoading: boolean;
  accessLoading: boolean;
  error: string | null;
  response: string | null;
  pendingActions: PendingWriteAction[];
  confirmingActions: boolean;
  usage: AiUsageStatus | null;
  dismissed: boolean;
  setDismissed: (value: boolean) => void;
  clearResponse: () => void;
  runPrompt: (prompt: string, options?: InlineAssistantRunOptions) => Promise<string | null>;
  confirmPendingActions: () => Promise<string | null>;
  cancelPendingActions: () => void;
}

export function useInlineAssistant(options: InlineAssistantOptions): InlineAssistantState {
  const { user, session, profile, baseProfile, isSuperAdmin } = useAuth();
  const { selectedClient, isPlanner } = usePlanner();
  const { entitlements: weddingEntitlements, couplePlanTier } = useWeddingEntitlements();
  const queryClient = useQueryClient();
  const [vendorListing, setVendorListing] = useState<VendorListingAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [usage, setUsage] = useState<AiUsageStatus | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingWriteAction[]>([]);
  const [confirmingActions, setConfirmingActions] = useState(false);
  const [lastRequest, setLastRequest] = useState<{
    messages: AiAssistantMessage[];
    prompt: string;
    runOptions?: InlineAssistantRunOptions;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const decision = useMemo<EntitlementDecision | null>(() => {
    if (!profile) return null;
    return getEntitlementDecision(options.feature, {
      profile,
      vendorListing,
      weddingEntitlements,
      couplePlanTier,
      bypass: isSuperAdmin || baseProfile?.role === 'admin',
    });
  }, [
    baseProfile?.role,
    couplePlanTier,
    isSuperAdmin,
    options.feature,
    profile,
    vendorListing,
    weddingEntitlements,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadVendorListing = async () => {
      if (profile?.role !== 'vendor' || isSuperAdmin || baseProfile?.role === 'admin') {
        setVendorListing(null);
        setAccessLoading(false);
        return;
      }

      setAccessLoading(true);
      const { data, error } = await supabase
        .from('vendor_listings')
        .select('id, is_approved, is_verified, verification_requested, subscription_status, subscription_expires_at')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Failed to load vendor assistant access state:', error);
        setVendorListing(null);
      } else {
        setVendorListing((data as VendorListingAccess | null) ?? null);
      }
      setAccessLoading(false);
    };

    void loadVendorListing();

    return () => {
      cancelled = true;
    };
  }, [baseProfile?.role, isSuperAdmin, profile?.role, profile?.user_id]);

  useEffect(() => {
    let cancelled = false;

    const loadUsage = async () => {
      if (!session || !decision?.allowed) {
        setUsage(null);
        setUsageLoading(false);
        return;
      }

      setUsageLoading(true);
      const { data, error } = await supabase.rpc('get_ai_usage_status');
      if (cancelled) return;

      if (error) {
        console.error('Failed to load AI usage status:', error);
      } else {
        setUsage((Array.isArray(data) ? data[0] : data) ?? null);
      }
      setUsageLoading(false);
    };

    void loadUsage();

    return () => {
      cancelled = true;
    };
  }, [decision?.allowed, session]);

  const runPrompt = useCallback(
    async (prompt: string, runOptions?: InlineAssistantRunOptions) => {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) return null;

      if (!session || !user) {
        setError('Your session is missing or expired. Please sign in again.');
        return null;
      }

      if (!decision?.allowed) {
        setError(decision?.description ?? 'AI assistant access is not available for this plan.');
        return null;
      }

      if (usage && usage.remaining_messages <= 0) {
        setError('This account has used its AI allowance for the current month.');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const conciergeContext = runOptions?.conciergeContext ?? options.conciergeContext ?? null;
        const contextMessages: AiAssistantMessage[] = conciergeContext?.trim()
          ? [{
              role: 'assistant',
              content: `${conciergeContext.trim()}\n\nUse this brief silently to make your answer contextual and concierge-like.`,
            }]
          : [];
        const messages: AiAssistantMessage[] = [
            ...contextMessages,
            ...(options.initialMessages ?? []),
            { role: 'user', content: trimmedPrompt },
          ];
        const result = await invokeWeddingAiChat({
          messages,
          selectedClientId: isPlanner ? selectedClient?.id ?? null : null,
          allowWriteActions: runOptions?.allowWriteActions ?? false,
          confirmedActions: [],
          page: options.page,
          surface: runOptions?.surface ?? options.surface,
          contextSource: runOptions?.contextSource ?? options.contextSource ?? 'inline_card',
          entityId: runOptions?.entityId ?? options.entityId ?? null,
          starterPrompt: trimmedPrompt,
        });

        if (result.usage) {
          setUsage(result.usage);
        }
        setPendingActions(result.pendingActions);
        setLastRequest({ messages, prompt: trimmedPrompt, runOptions });
        setResponse(result.content);
        return result.content;
      } catch (err) {
        console.error('Inline assistant error:', err);
        if (err instanceof WeddingAiInvokeError) {
          if (err.usage) {
            setUsage(err.usage);
          }
          setError(err.message);
          return null;
        }

        setError('Could not reach the AI assistant.');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [
      decision?.allowed,
      decision?.description,
      isPlanner,
      options.contextSource,
      options.conciergeContext,
      options.entityId,
      options.initialMessages,
      options.page,
      options.surface,
      selectedClient?.id,
      session,
      usage,
      user,
    ],
  );

  const confirmPendingActions = useCallback(async () => {
    if (!lastRequest || pendingActions.length === 0 || confirmingActions) return null;

    setConfirmingActions(true);
    setError(null);
    try {
      const result = await invokeWeddingAiChat({
        messages: lastRequest.messages,
        selectedClientId: isPlanner ? selectedClient?.id ?? null : null,
        allowWriteActions: true,
        confirmedActions: pendingActions,
        page: options.page,
        surface: 'assistant_panel_confirmed_write',
        contextSource: lastRequest.runOptions?.contextSource ?? options.contextSource ?? 'assistant_panel',
        entityId: lastRequest.runOptions?.entityId ?? options.entityId ?? null,
        starterPrompt: lastRequest.prompt,
      });

      if (result.usage) setUsage(result.usage);
      setPendingActions([]);
      setResponse(result.content);
      await queryClient.invalidateQueries({ type: 'active' });
      return result.content;
    } catch (err) {
      console.error('Assistant action confirmation error:', err);
      setError(err instanceof WeddingAiInvokeError ? err.message : 'Could not apply the confirmed changes.');
      return null;
    } finally {
      setConfirmingActions(false);
    }
  }, [
    confirmingActions,
    isPlanner,
    lastRequest,
    options.contextSource,
    options.entityId,
    options.page,
    pendingActions,
    queryClient,
    selectedClient?.id,
  ]);

  const cancelPendingActions = useCallback(() => {
    setPendingActions([]);
    setResponse('## No changes made\n\nI held off on those actions. I can revise the plan or prepare a smaller change instead.');
  }, []);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
    setPendingActions([]);
  }, []);

  return {
    decision,
    canUseAssistant: Boolean(decision?.allowed),
    loading,
    usageLoading,
    accessLoading,
    error,
    response,
    pendingActions,
    confirmingActions,
    usage,
    dismissed,
    setDismissed,
    clearResponse,
    runPrompt,
    confirmPendingActions,
    cancelPendingActions,
  };
}
