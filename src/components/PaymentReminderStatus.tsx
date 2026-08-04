import { CalendarClock, PencilLine } from 'lucide-react';

interface PaymentReminderStatusProps {
  dueDate?: string | null;
  vendorName?: string;
  saved?: boolean;
  inputId: string;
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

export function PaymentReminderStatus({ dueDate, vendorName, saved = false, inputId }: PaymentReminderStatusProps) {
  const openDatePicker = () => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;

    input.focus({ preventScroll: true });
    try {
      input.showPicker?.();
    } catch {
      input.click();
    }
  };

  if (!dueDate) {
    return (
      <button
        type="button"
        onClick={openDatePicker}
        className="group flex w-full items-start gap-2 border-l-2 border-border pl-3 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Schedule a payment reminder"
      >
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
        <span className="text-xs leading-relaxed text-muted-foreground group-hover:text-foreground">
          Choose a date to schedule this payment in Zania Attention.
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openDatePicker}
      className="group flex w-full items-start gap-2 border-l-2 border-primary/45 pl-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Change payment reminder currently scheduled for ${formatReminderDate(dueDate)}`}
    >
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1" aria-live="polite">
        <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="font-medium text-foreground">
            {saved ? 'Reminder scheduled' : 'Save to update reminder'} for {formatReminderDate(dueDate)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            Change reminder
          </span>
        </span>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {saved
            ? `This date is shared across Vendors, Budget, and Zania Attention${vendorName ? ` for ${vendorName}` : ''}.`
            : 'Save once to update this date everywhere.'}
        </p>
      </span>
    </button>
  );
}
