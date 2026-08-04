import { CalendarClock } from 'lucide-react';

interface PaymentReminderStatusProps {
  dueDate?: string | null;
  vendorName?: string;
  saved?: boolean;
}

function formatReminderDate(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PaymentReminderStatus({ dueDate, vendorName, saved = false }: PaymentReminderStatusProps) {
  if (!dueDate) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Choose a date and save to add this payment to Zania Attention.
      </p>
    );
  }

  return (
    <div className="flex items-start gap-2 border-l-2 border-primary/45 pl-3 text-sm" aria-live="polite">
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">
          {saved ? 'Reminder scheduled' : 'Save to schedule reminder'} for {formatReminderDate(dueDate)}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {saved ? 'Zania will keep' : 'Zania will then keep'} {vendorName ? `${vendorName}'s ` : 'this '}payment visible in Attention as the date approaches.
        </p>
      </div>
    </div>
  );
}
