import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatedCardDetails } from '@/components/AnimatedCardDetails';
import { cn } from '@/lib/utils';

type HierarchyTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface HierarchyGroupProps {
  children: ReactNode;
  compact?: boolean;
  eyebrow: string;
  footer?: ReactNode;
  meta?: ReactNode;
  onToggle: () => void;
  open: boolean;
  status: string;
  summary?: ReactNode;
  title: string;
  tone?: HierarchyTone;
}

const toneClasses: Record<HierarchyTone, { accent: string; status: string; surface: string }> = {
  neutral: {
    accent: 'bg-primary/35',
    status: 'text-muted-foreground',
    surface: 'border-border/80 bg-muted/35 hover:border-primary/30 hover:bg-muted/50',
  },
  info: {
    accent: 'bg-info',
    status: 'text-info',
    surface: 'semantic-surface-info hover:border-info/40',
  },
  success: {
    accent: 'bg-success',
    status: 'text-success',
    surface: 'semantic-surface-success hover:border-success/40',
  },
  warning: {
    accent: 'bg-warning',
    status: 'text-warning-foreground',
    surface: 'semantic-surface-warning hover:border-warning/40',
  },
  danger: {
    accent: 'bg-destructive',
    status: 'text-destructive',
    surface: 'semantic-surface-danger hover:border-destructive/40',
  },
};

export function HierarchyGroup({
  children,
  compact = false,
  eyebrow,
  footer,
  meta,
  onToggle,
  open,
  status,
  summary,
  title,
  tone = 'neutral',
}: HierarchyGroupProps) {
  const styles = toneClasses[tone];

  return (
    <section className="w-full min-w-0 max-w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${title}. ${status}. ${open ? 'Collapse' : 'Expand'}`}
        onClick={onToggle}
        className={cn(
          'group relative w-full overflow-hidden rounded-2xl border text-left',
          'shadow-[0_12px_32px_-30px_hsl(var(--foreground)/0.5)] transition-[border-color,background-color,box-shadow]',
          'hover:shadow-[0_18px_38px_-28px_hsl(var(--foreground)/0.5)]',
          compact ? 'px-5 py-4 sm:px-6' : 'px-5 py-5 sm:px-7',
          styles.surface,
        )}
      >
        <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1.5', styles.accent)} />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
              <span className={cn('inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]', styles.status)}>
                <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', styles.accent)} />
                {status}
              </span>
            </div>
            <h3 className={cn(
              'break-words font-semibold text-foreground',
              compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
            )}>
              {title}
            </h3>
            {summary}
            {footer}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {meta ? <div className="hidden text-xs text-muted-foreground sm:block">{meta}</div> : null}
            <ChevronDown
              aria-hidden="true"
              className={cn('h-5 w-5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
            />
          </div>
        </div>
      </button>

      <AnimatedCardDetails open={open}>
        <div className="relative ml-2 min-w-0 max-w-[calc(100%_-_0.5rem)] pl-4 pt-4 sm:ml-7 sm:max-w-[calc(100%_-_1.75rem)] sm:pl-7">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-primary/45 via-primary/20 to-transparent"
          />
          <span
            aria-hidden="true"
            className="absolute left-[-3px] top-7 h-[7px] w-[7px] rounded-full bg-primary/55 ring-4 ring-background"
          />
          {children}
        </div>
      </AnimatedCardDetails>
    </section>
  );
}
