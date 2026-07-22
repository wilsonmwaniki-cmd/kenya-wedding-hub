import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';
import { cn } from '@/lib/utils';

interface ContextualAssistantActionProps {
  prompt: string;
  context: string;
  label?: string;
  className?: string;
}

export default function ContextualAssistantAction({
  prompt,
  context,
  label = 'Ask Zania',
  className,
}: ContextualAssistantActionProps) {
  const assistantPanel = useAssistantPanel();
  if (!assistantPanel) return null;

  return (
    <Button
      type="button"
      variant="outline"
      className={cn('min-h-11 gap-2', className)}
      onClick={() => assistantPanel.openAssistant(prompt, context)}
    >
      <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
      {label}
    </Button>
  );
}
