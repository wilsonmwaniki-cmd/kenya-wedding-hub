import * as React from 'react';

import { cn } from '@/lib/utils';

type TonalCardTone = 'porcelain' | 'sage' | 'sky' | 'oat' | 'clay' | 'ink';
type StatusTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

const tonalCardTones: Record<TonalCardTone, string> = {
  porcelain: 'border-[#e4d8ca] bg-[#fbf8f3] text-[#251e1a]',
  sage: 'border-[#c9ddd0] bg-[#eef6f0] text-[#213026]',
  sky: 'border-[#cbdbea] bg-[#eef4fb] text-[#222b35]',
  oat: 'border-[#decdae] bg-[#f5ecdc] text-[#30271e]',
  clay: 'border-[#d9ad98] bg-[#c96f49] text-[#fff8f1]',
  ink: 'border-[#3b3530] bg-[#272320] text-[#f8f0e6]',
};

const statusTones: Record<StatusTone, string> = {
  neutral: 'bg-[#9a8f86]',
  success: 'bg-[#2f9d68]',
  warning: 'bg-[#d69a26]',
  info: 'bg-[#4d83bd]',
  danger: 'bg-[#d9363e]',
};

interface TonalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: TonalCardTone;
}

const TonalCard = React.forwardRef<HTMLDivElement, TonalCardProps>(
  ({ className, tone = 'porcelain', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'overflow-hidden rounded-[1.25rem] border shadow-[0_1px_1px_rgba(42,34,29,0.025),0_12px_32px_-28px_rgba(42,34,29,0.28)]',
        tonalCardTones[tone],
        className,
      )}
      {...props}
    />
  ),
);
TonalCard.displayName = 'TonalCard';

const TonalCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-2 px-5 pb-4 pt-5 sm:px-7 sm:pt-7', className)} {...props} />
  ),
);
TonalCardHeader.displayName = 'TonalCardHeader';

const TonalCardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-editorial text-[1.55rem] font-semibold leading-tight tracking-[-0.025em]', className)}
      {...props}
    />
  ),
);
TonalCardTitle.displayName = 'TonalCardTitle';

const TonalCardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('max-w-2xl text-sm leading-6 text-current/65', className)} {...props} />
  ),
);
TonalCardDescription.displayName = 'TonalCardDescription';

const TonalCardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-5 pb-5 sm:px-7 sm:pb-7', className)} {...props} />
  ),
);
TonalCardBody.displayName = 'TonalCardBody';

interface TonalCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'quiet' | 'oat' | 'ink';
}

const footerTones: Record<NonNullable<TonalCardFooterProps['tone']>, string> = {
  quiet: 'border-current/10 bg-white/22',
  oat: 'border-[#d8c5a4] bg-[#ead8b8] text-[#2b211a]',
  ink: 'border-[#3b3530] bg-[#272320] text-[#f8f0e6]',
};

const TonalCardFooter = React.forwardRef<HTMLDivElement, TonalCardFooterProps>(
  ({ className, tone = 'quiet', ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:px-7', footerTones[tone], className)}
      {...props}
    />
  ),
);
TonalCardFooter.displayName = 'TonalCardFooter';

const TonalSection = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('border-t border-current/10 pt-5', className)} {...props} />
  ),
);
TonalSection.displayName = 'TonalSection';

interface StatusLineProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: StatusTone;
}

const StatusLine = React.forwardRef<HTMLDivElement, StatusLineProps>(
  ({ className, label, value, detail, tone = 'neutral', ...props }, ref) => (
    <div ref={ref} className={cn('relative min-w-0 pl-4', className)} {...props}>
      <span className={cn('absolute bottom-1 left-0 top-1 w-0.5 rounded-sm', statusTones[tone])} aria-hidden="true" />
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-current/55">{label}</p>
      <div className="mt-1 text-sm font-semibold leading-5 text-current">{value}</div>
      {detail ? <div className="mt-1 text-xs leading-5 text-current/60">{detail}</div> : null}
    </div>
  ),
);
StatusLine.displayName = 'StatusLine';

interface MetaRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
}

const MetaRow = React.forwardRef<HTMLDivElement, MetaRowProps>(
  ({ className, label, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('grid gap-1 border-b border-current/10 py-3 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline', className)}
      {...props}
    >
      <dt className="text-xs font-medium text-current/55">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-current">{value}</dd>
    </div>
  ),
);
MetaRow.displayName = 'MetaRow';

export {
  MetaRow,
  StatusLine,
  TonalCard,
  TonalCardBody,
  TonalCardDescription,
  TonalCardFooter,
  TonalCardHeader,
  TonalCardTitle,
  TonalSection,
};
