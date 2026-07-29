import * as React from 'react';

import { cn } from '@/lib/utils';

type EditorialEyebrowTone = 'primary' | 'info' | 'neutral' | 'light';

const toneClasses: Record<EditorialEyebrowTone, { line: string; text: string }> = {
  primary: {
    line: 'bg-primary',
    text: 'text-primary',
  },
  info: {
    line: 'bg-info',
    text: 'text-info',
  },
  neutral: {
    line: 'bg-foreground/35',
    text: 'text-muted-foreground',
  },
  light: {
    line: 'bg-current/45',
    text: 'text-current/70',
  },
};

interface EditorialEyebrowProps extends React.HTMLAttributes<HTMLParagraphElement> {
  tone?: EditorialEyebrowTone;
}

const EditorialEyebrow = React.forwardRef<HTMLParagraphElement, EditorialEyebrowProps>(
  ({ children, className, tone = 'primary', ...props }, ref) => {
    const styles = toneClasses[tone];

    return (
      <p
        ref={ref}
        className={cn(
          'inline-flex items-center gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em]',
          styles.text,
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className={cn('h-px w-7 shrink-0', styles.line)} />
        <span>{children}</span>
      </p>
    );
  },
);
EditorialEyebrow.displayName = 'EditorialEyebrow';

export { EditorialEyebrow };
