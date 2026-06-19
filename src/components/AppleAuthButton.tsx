import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function AppleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.61 12.12c.03 2.96 2.6 3.95 2.63 3.96-.02.07-.41 1.41-1.34 2.8-.81 1.2-1.65 2.4-2.98 2.43-1.31.02-1.73-.78-3.23-.78s-1.97.76-3.2.8c-1.29.05-2.28-1.29-3.09-2.48C3.72 16.44 2.43 12 4.19 8.95c.87-1.5 2.43-2.45 4.13-2.47 1.29-.02 2.5.87 3.23.87.72 0 2.08-1.07 3.51-.91.6.02 2.27.24 3.34 1.81-.09.06-1.99 1.16-1.97 3.87ZM14.11 3.95c.68-.82 1.14-1.96 1.01-3.09-.98.04-2.16.65-2.87 1.47-.63.73-1.18 1.89-1.03 3 1.09.08 2.2-.56 2.89-1.38Z" />
    </svg>
  );
}

interface AppleAuthButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void | Promise<void>;
  text?: string;
}

export default function AppleAuthButton({
  disabled,
  loading,
  onClick,
  text = 'Continue with Apple',
}: AppleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={disabled || loading}
      onClick={() => void onClick()}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />}
      {text}
    </Button>
  );
}
