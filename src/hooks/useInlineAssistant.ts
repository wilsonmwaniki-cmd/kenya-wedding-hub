import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import {
  invokeWeddingAiChat,
  WeddingAiInvokeError,
  type AiAssistantMessage,
  type AiUsageStatus,
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
  conversationId?: string | null;
}

export interface InlineAssistantRunOptions {
  allowWriteActions?: boolean;
  entityId?: string | null;
  surface?: string | null;
  contextSource?: string | null;
  conciergeContext?: string | null;
}

export interface InlineAssistantState {
  workspaceKey: string;
  decision: EntitlementDecision | null;
  canUseAssistant: boolean;
  loading: boolean;
  usageLoading: boolean;
  accessLoading: boolean;
  error: string | null;
  response: string | null;
  usage: AiUsageStatus | null;
  dismissed: boolean;
  conversationId: string | null;
  setDismissed: (value: boolean) => void;
  clearResponse: () => void;
  runPrompt: (prompt: string, options?: InlineAssistantRunOptions) => Promise<string | null>;
}

export function useInlineAssistant(options: InlineAssistantOptions): InlineAssistantState {
  const { user, session, profile, baseProfile, isSuperAdmin } = useAuth();
  const { selectedClient, isPlanner } = usePlanner();
  const { entitlements: weddingEntitlements, couplePlanTier } = useWeddingEntitlements();
  const [vendorListing, setVendorListing] = useState<VendorListingAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [usage, setUsage] = useState<AiUsageStatus | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(options.conversationId ?? null);
  const workspaceKey = `${user?.id ?? ''}:${profile?.role ?? ''}:${profile?.planner_type ?? ''}:${isPlanner ? selectedClient?.id ?? '' : ''}`;
  const workspaceKeyRef = useRef(workspaceKey);
  const requestVersionRef = useRef(0);
  if (workspaceKeyRef.current !== workspaceKey) {
    workspaceKeyRef.current = workspaceKey;
    requestVersionRef.current += 1;
  }

  useEffect(() => {
    setResponse(null);
    setError(null);
    setLoading(false);
  }, [workspaceKey]);

  useEffect(() => {
    setConversationId(options.conversationId ?? null);
  }, [options.conversationId, workspaceKey]);

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
      const { data, error } = await (supabase.rpc as any)('get_ai_usage_status');
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

      if (usage && usage.remaining_cost_usd <= 0) {
        setError('This account has used its included Zania Assistant allowance for the current month.');
        return null;
      }

      setLoading(true);
      setError(null);
      const requestVersion = ++requestVersionRef.current;

      try {
        const conciergeContext = runOptions?.conciergeContext ?? options.conciergeContext ?? null;
        const contextMessages: AiAssistantMessage[] = conciergeContext?.trim()
          ? [{
              role: 'assistant',
              content: `${conciergeContext.trim()}\n\nUse this brief silently to make your answer contextual and concierge-like.`,
            }]
          : [];
        const result = await invokeWeddingAiChat({
          messages: [
            ...contextMessages,
            ...(options.initialMessages ?? []),
            { role: 'user', content: trimmedPrompt },
          ],
          selectedClientId: isPlanner ? selectedClient?.id ?? null : null,
          allowWriteActions: runOptions?.allowWriteActions ?? false,
          confirmedActions: [],
          page: options.page,
          surface: runOptions?.surface ?? options.surface,
          contextSource: runOptions?.contextSource ?? options.contextSource ?? 'inline_card',
          entityId: runOptions?.entityId ?? options.entityId ?? null,
          starterPrompt: trimmedPrompt,
          conversationId,
        });

        if (requestVersionRef.current !== requestVersion) return null;
        if (result.usage) {
          setUsage(result.usage);
        }
        if (result.conversationId) setConversationId(result.conversationId);
        setResponse(result.content);
        return result.content;
      } catch (err) {
        if (requestVersionRef.current !== requestVersion) return null;
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
        if (requestVersionRef.current === requestVersion) setLoading(false);
      }
    },
    [
      decision?.allowed,
      decision?.description,
      isPlanner,
      options.contextSource,
      conversationId,
      options.conciergeContext,
      options.entityId,
      options.initialMessages,
      options.page,
      options.surface,
      selectedClient?.id,
      session,
      usage,
      user,
      workspaceKey,
    ],
  );

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return {
    workspaceKey,
    decision,
    canUseAssistant: Boolean(decision?.allowed),
    loading,
    usageLoading,
    accessLoading,
    error,
    response,
    usage,
    dismissed,
    conversationId,
    setDismissed,
    clearResponse,
    runPrompt,
  };
}
