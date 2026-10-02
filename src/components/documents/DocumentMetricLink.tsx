import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface DocumentMetricLinkProps {
  to: string;
  label: string;
  value: string | number;
  hint: string;
  tone?: 'default' | 'success' | 'warning';
}

const toneClass = {
  default: 'text-foreground',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
};

export default function DocumentMetricLink({
  to,
  label,
  value,
  hint,
  tone = 'default',
}: DocumentMetricLinkProps) {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}. ${hint}`}
      className="group min-w-0 rounded-2xl border border-border/70 bg-white/80 p-4 transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary/65 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
      </div>
      <p className={`mt-2 break-words text-xl font-semibold leading-tight ${toneClass[tone]}`}>{value}</p>
      <p className="mt-2 text-xs font-medium text-muted-foreground">{hint}</p>
    </Link>
  );
}
