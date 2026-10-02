import type { ReactNode } from 'react';

export type DocumentSummaryItem = {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'success' | 'warning';
};

const toneClass = {
  default: 'text-foreground',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
};

export default function DocumentSummaryRail({ items }: { items: DocumentSummaryItem[] }) {
  return (
    <dl className="grid overflow-hidden border-y border-border/70 bg-background/35 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`min-w-0 px-1 py-4 sm:px-5 ${index > 0 ? 'border-t border-border/70 sm:border-l sm:border-t-0' : ''}`}
        >
          <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {item.label}
          </dt>
          <dd className={`mt-1.5 break-words text-xl font-semibold leading-tight ${toneClass[item.tone ?? 'default']}`}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
