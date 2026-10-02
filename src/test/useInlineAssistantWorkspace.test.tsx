import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInlineAssistant } from '@/hooks/useInlineAssistant';

const mocks = vi.hoisted(() => ({
  clientId: 'wedding-one', invoke: vi.fn(),
  profile: { role: 'planner', planner_type: 'professional' },
  user: { id: 'planner' }, session: { access_token: 'test-token' },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, session: mocks.session, profile: mocks.profile }) }));
vi.mock('@/contexts/PlannerContext', () => ({ usePlanner: () => ({ isPlanner: true, selectedClient: { id: mocks.clientId } }) }));
vi.mock('@/hooks/useWeddingEntitlements', () => ({ useWeddingEntitlements: () => ({ entitlements: {}, couplePlanTier: null }) }));
vi.mock('@/lib/entitlements', () => ({ getEntitlementDecision: () => ({ allowed: true }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) } }));
vi.mock('@/lib/aiAssistant', () => ({ invokeWeddingAiChat: (...args: unknown[]) => mocks.invoke(...args), WeddingAiInvokeError: class extends Error {} }));

describe('assistant workspace isolation', () => {
  beforeEach(() => { mocks.clientId = 'wedding-one'; mocks.invoke.mockReset(); });

  it('discards an in-flight answer after switching wedding, even if switching back', async () => {
    let finish: (value: { content: string; usage: null }) => void;
    mocks.invoke.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(() => useInlineAssistant({ feature: 'planner.ai_assistant', page: 'dashboard', surface: 'assistant_panel' }));
    let request: Promise<string | null>;
    act(() => { request = result.current.runPrompt('How is my wedding doing?'); });
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    mocks.clientId = 'wedding-two'; rerender();
    mocks.clientId = 'wedding-one'; rerender();
    await act(async () => { finish!({ content: 'Stale wedding answer', usage: null }); await request!; });
    expect(await request!).toBeNull();
    expect(result.current.response).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sends the selected client and keeps a current answer', async () => {
    mocks.invoke.mockResolvedValue({ content: 'Current wedding answer', usage: null });
    const { result } = renderHook(() => useInlineAssistant({ feature: 'planner.ai_assistant', page: 'dashboard', surface: 'assistant_panel' }));
    await act(async () => { await result.current.runPrompt('How is my wedding doing?'); });
    expect(mocks.invoke).toHaveBeenCalledWith(expect.objectContaining({ selectedClientId: 'wedding-one', allowWriteActions: false, confirmedActions: [] }));
    expect(result.current.response).toBe('Current wedding answer');
  });
});
