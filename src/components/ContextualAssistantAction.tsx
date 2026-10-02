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
      className={cn('min-h-11', className)}
      onClick={() => assistantPanel.openAssistant(prompt, context)}
    >
      {label}
    </Button>
  );
}
