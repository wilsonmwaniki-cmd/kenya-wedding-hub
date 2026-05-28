import { cn } from '@/lib/utils';

type BrandWordmarkProps = {
  light?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showUnderline?: boolean;
  className?: string;
};

const sizeStyles = {
  sm: {
    text: 'text-[1.7rem] tracking-[0.2em]',
    underline: 'w-14',
    gap: 'gap-2',
  },
  md: {
    text: 'text-[2.15rem] tracking-[0.22em]',
    underline: 'w-16',
    gap: 'gap-2.5',
  },
  lg: {
    text: 'text-[2.35rem] tracking-[0.22em]',
    underline: 'w-20',
    gap: 'gap-3',
  },
} as const;

export default function BrandWordmark({
  light = false,
  size = 'md',
  showUnderline = true,
  className,
}: BrandWordmarkProps) {
  const styles = sizeStyles[size];

  return (
    <div className={cn('inline-flex flex-col', styles.gap, className)}>
      <div
        aria-label="Zania"
        className={cn(
          'font-editorial font-light uppercase leading-none',
          styles.text,
          light ? 'text-[#f6eee6]' : 'text-[#201814]',
        )}
      >
        <span>Z</span>
        <span className="text-[#d4bb7d]">A</span>
        <span>NIA</span>
      </div>
      {showUnderline ? (
        <div className={cn('h-[2px]', styles.underline, light ? 'bg-[#c9a96e]' : 'bg-[#c2724f]')} />
      ) : null}
    </div>
  );
}
