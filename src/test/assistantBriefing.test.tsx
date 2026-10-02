import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantPanel from '@/components/AssistantPanel';
import {
  AssistantPanelProvider,
  useAssistantPanel,
} from '@/contexts/AssistantPanelContext';

const assistantMocks = vi.hoisted(() => ({
  clearResponse: vi.fn(),
  runPrompt: vi.fn(),
  workspaceKey: 'couple:one',
  historyMessages: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
}));

vi.mock('@/hooks/useInlineAssistant', () => ({
  useInlineAssistant: () => ({
    workspaceKey: assistantMocks.workspaceKey,
    decision: { allowed: true },
    canUseAssistant: true,
    loading: false,
    usageLoading: false,
    accessLoading: false,
    error: null,
    response: null,
    usage: null,
    dismissed: false,
    conversationId: null,
    setDismissed: vi.fn(),
    clearResponse: assistantMocks.clearResponse,
    runPrompt: assistantMocks.runPrompt,
  }),
}));

vi.mock('@/lib/assistantConversations', () => ({
  getAssistantAudience: () => 'couple',
  loadLatestAssistantConversation: async () => ({
    conversationId: assistantMocks.historyMessages.length ? 'persisted-conversation' : null,
    messages: assistantMocks.historyMessages,
  }),
}));

function BriefingHarness() {
  const assistantPanel = useAssistantPanel();

  return (
    <button
      type="button"
      onClick={() => assistantPanel?.openAssistant(
        'Prepare the briefing now.',
        'Verified attention context',
        {
          autoSubmit: true,
          actions: [{ label: 'Review payment', path: '/vendor-documents/invoices' }],
        },
      )}
    >
      Brief me
    </button>
  );
}

describe('AssistantPanel contextual briefing', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    assistantMocks.clearResponse.mockReset();
    assistantMocks.runPrompt.mockReset();
    assistantMocks.runPrompt.mockResolvedValue('Review the invoice payment first.');
    assistantMocks.workspaceKey = 'couple:one';
    assistantMocks.historyMessages = [];
  });

  it('runs immediately and exposes the verified next action', async () => {
    render(
      <MemoryRouter>
        <AssistantPanelProvider>
          <BriefingHarness />
          <AssistantPanel role="vendor" />
        </AssistantPanelProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Brief me' }));

    await waitFor(() => expect(assistantMocks.runPrompt).toHaveBeenCalledTimes(1));
    expect(assistantMocks.runPrompt).toHaveBeenCalledWith(
      'Prepare the briefing now.',
      expect.objectContaining({
        conciergeContext: 'Verified attention context',
        surface: 'assistant_panel_briefing',
      }),
    );
    expect(await screen.findByText('Review the invoice payment first.')).toBeInTheDocument();
    expect(screen.queryByText('Prepare the briefing now.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review payment/i })).toHaveAttribute(
      'href',
      '/vendor-documents/invoices',
    );
  });

  it('offers both read-only questions and renders the answer', async () => {
    assistantMocks.runPrompt.mockResolvedValue('12 of 20 tasks complete.');
    render(<MemoryRouter><AssistantPanelProvider><AssistantPanel role="couple" /></AssistantPanelProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open Ask Zania assistant' }));
    expect(await screen.findByRole('button', { name: 'What should I focus on this week?' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'How is my wedding doing?' }));
    expect(await screen.findByText('12 of 20 tasks complete.')).toBeInTheDocument();
    expect(assistantMocks.runPrompt).toHaveBeenCalledWith('How is my wedding doing?', expect.objectContaining({ surface: 'assistant_panel_suggestion' }));
  });

  it('does not offer broad wedding summaries in vendor context', () => {
    render(<MemoryRouter><AssistantPanelProvider><AssistantPanel role="vendor" /></AssistantPanelProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open Ask Zania assistant' }));
    expect(screen.queryByRole('button', { name: 'How is my wedding doing?' })).not.toBeInTheDocument();
  });

  it('restores persisted messages when the assistant opens again', async () => {
    assistantMocks.historyMessages = [
      { role: 'user', content: 'What needs attention?' },
      { role: 'assistant', content: 'Confirm the selected vendor quote.' },
    ];
    render(<MemoryRouter><AssistantPanelProvider><AssistantPanel role="couple" /></AssistantPanelProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open Ask Zania assistant' }));
    expect(await screen.findByText('What needs attention?')).toBeInTheDocument();
    expect(screen.getByText('Confirm the selected vendor quote.')).toBeInTheDocument();
  });

  it('keeps the planner conversation visible when the active client changes', async () => {
    const view = <MemoryRouter><AssistantPanelProvider><AssistantPanel role="planner" plannerType="professional" /></AssistantPanelProvider></MemoryRouter>;
    const { rerender } = render(view);
    fireEvent.click(screen.getByRole('button', { name: 'Open Ask Zania assistant' }));
    fireEvent.click(await screen.findByRole('button', { name: 'How is my wedding doing?' }));
    expect(await screen.findByText('Review the invoice payment first.')).toBeInTheDocument();
    assistantMocks.workspaceKey = 'planner:two';
    rerender(<MemoryRouter><AssistantPanelProvider><AssistantPanel role="planner" plannerType="professional" /></AssistantPanelProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Review the invoice payment first.')).toBeInTheDocument());
  });
});
