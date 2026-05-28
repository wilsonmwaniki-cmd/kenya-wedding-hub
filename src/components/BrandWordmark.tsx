import { cn } from '@/lib/utils';

type BrandWordmarkProps = {
  light?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showUnderline?: boolean;
  className?: string;
};

const sizeStyles = {
  sm: {
    text: 'text-[1.72rem] tracking-[0.28em]',
    underline: 'w-16',
    gap: 'gap-2',
  },
  md: {
    text: 'text-[2.18rem] tracking-[0.3em]',
    underline: 'w-[4.6rem]',
    gap: 'gap-2.5',
  },
  lg: {
    text: 'text-[2.55rem] tracking-[0.32em]',
    underline: 'w-24',
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
          'font-editorial uppercase leading-none',
          styles.text,
          light ? 'text-[#f6eee6]' : 'text-[#201814]',
        )}
      >
        <span className="font-[300]">Z</span>
        <span className="inline-block scale-[1.04] font-[400] text-[#d4bb7d]">A</span>
        <span className="font-[300]">NIA</span>
      </div>
      {showUnderline ? (
        <div className={cn('h-[2px]', styles.underline, light ? 'bg-[#c9a96e]' : 'bg-[#c2724f]')} />
      ) : null}
    </div>
  );
}
