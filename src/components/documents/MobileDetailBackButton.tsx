import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type MobileDetailBackButtonProps = {
  label?: string;
  onBack: () => void;
};

export default function MobileDetailBackButton({
  label = 'Back to documents',
  onBack,
}: MobileDetailBackButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onBack}
      className="-ml-2 w-fit gap-2 px-2 text-muted-foreground md:hidden"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
