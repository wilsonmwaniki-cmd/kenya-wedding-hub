import { motion } from 'framer-motion';

interface SlidingSegmentedControlProps<T extends string> {
  label: string;
  layoutId: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  reducedMotion?: boolean;
  minWidthClassName?: string;
}

export function SlidingSegmentedControl<T extends string>({
  label,
  layoutId,
  value,
  options,
  onChange,
  reducedMotion = false,
  minWidthClassName = 'min-w-[17rem]',
}: SlidingSegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-grid max-w-full grid-flow-col auto-cols-fr rounded-lg border border-border bg-background p-1 ${minWidthClassName}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`relative min-h-10 min-w-0 rounded-md px-2 py-2 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4 sm:text-sm ${active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-primary shadow-sm"
                initial={false}
                transition={{ duration: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}
              />
            ) : null}
            <span className="relative z-10 whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
