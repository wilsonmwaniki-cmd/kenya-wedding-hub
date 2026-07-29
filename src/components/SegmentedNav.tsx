import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type SegmentedNavItem = {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: string | number;
  badgeLabel?: string;
};

type IndicatorPosition = {
  left: number;
  width: number;
  ready: boolean;
};

type SegmentedNavProps = {
  items: SegmentedNavItem[];
  value: string;
  onValueChange?: (value: string) => void;
  showIcons?: boolean;
  viewportFill?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function SegmentedNav({
  items,
  value,
  onValueChange,
  showIcons = true,
  viewportFill = false,
  ariaLabel = 'Workspace sections',
  className,
}: SegmentedNavProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [indicator, setIndicator] = useState<IndicatorPosition>({
    left: 0,
    width: 0,
    ready: false,
  });

  const measureIndicator = useCallback(() => {
    const activeItem = itemRefs.current.get(value);
    if (!activeItem) {
      setIndicator((current) => ({ ...current, ready: false }));
      return;
    }

    setIndicator({
      left: activeItem.offsetLeft,
      width: activeItem.offsetWidth,
      ready: true,
    });
  }, [value]);

  useLayoutEffect(() => {
    measureIndicator();

    const control = controlRef.current;
    if (!control) return;

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => measureIndicator());

    observer?.observe(control);
    itemRefs.current.forEach((item) => observer?.observe(item));
    window.addEventListener('resize', measureIndicator);

    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) measureIndicator();
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener('resize', measureIndicator);
    };
  }, [items, measureIndicator]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const activeItem = itemRefs.current.get(value);
    if (!scroller || !activeItem) return;

    const itemStart = activeItem.offsetLeft;
    const itemEnd = itemStart + activeItem.offsetWidth;
    const visibleStart = scroller.scrollLeft;
    const visibleEnd = visibleStart + scroller.clientWidth;

    if (itemStart < visibleStart) {
      scroller.scrollLeft = Math.max(0, itemStart - 4);
    } else if (itemEnd > visibleEnd) {
      scroller.scrollLeft = itemEnd - scroller.clientWidth + 4;
    }
  }, [value]);

  const focusAndSelect = (item: SegmentedNavItem) => {
    const target = itemRefs.current.get(item.id);
    if (!target || item.disabled) return;

    target.focus();
    target.click();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLAnchorElement>,
    item: SegmentedNavItem,
  ) => {
    const enabledItems = items.filter((candidate) => !candidate.disabled);
    const currentIndex = enabledItems.findIndex((candidate) => candidate.id === item.id);
    if (currentIndex < 0) return;

    let target: SegmentedNavItem | undefined;

    if (event.key === 'ArrowRight') {
      target = enabledItems[(currentIndex + 1) % enabledItems.length];
    } else if (event.key === 'ArrowLeft') {
      target = enabledItems[(currentIndex - 1 + enabledItems.length) % enabledItems.length];
    } else if (event.key === 'Home') {
      target = enabledItems[0];
    } else if (event.key === 'End') {
      target = enabledItems[enabledItems.length - 1];
    } else if (event.key === ' ') {
      event.preventDefault();
      event.currentTarget.click();
      return;
    } else {
      return;
    }

    event.preventDefault();
    focusAndSelect(target);
  };

  const indicatorStyle = {
    width: indicator.width,
    transform: `translateX(${indicator.left}px)`,
  } satisfies CSSProperties;

  return (
    <div
      ref={scrollerRef}
      className={cn(
        'flex max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        viewportFill
          ? 'w-full justify-stretch overflow-hidden'
          : 'justify-start overflow-x-auto overscroll-x-contain sm:justify-center',
        className,
      )}
    >
      <div
        ref={controlRef}
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'relative inline-flex items-center gap-0 rounded-full border border-border/45 bg-muted/80 p-1 shadow-[0_1px_1px_rgba(30,28,25,0.018),0_4px_12px_rgba(30,28,25,0.025),inset_0_1px_0_rgba(255,255,255,0.46)]',
          viewportFill ? 'h-[4.5rem] w-full min-w-0' : 'h-14 min-w-max',
        )}
      >
        <span
          aria-hidden="true"
          data-ready={indicator.ready}
          style={indicatorStyle}
          className="pointer-events-none absolute bottom-1 left-0 top-1 z-0 rounded-full bg-background opacity-0 shadow-[0_1px_1px_rgba(38,35,31,0.035),0_2px_5px_rgba(38,35,31,0.045),0_7px_16px_rgba(38,35,31,0.035),inset_0_1px_0_rgba(255,255,255,0.82),inset_0_-1px_0_rgba(40,37,33,0.025)] transition-[transform,width,opacity] [transition-duration:260ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] data-[ready=true]:opacity-100 motion-reduce:transition-none"
        />

        {items.map((item) => {
          const active = item.id === value;

          return (
            <Link
              key={item.id}
              ref={(node) => {
                if (node) itemRefs.current.set(item.id, node);
                else itemRefs.current.delete(item.id);
              }}
              to={item.disabled ? '#' : item.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              aria-disabled={item.disabled || undefined}
              tabIndex={active && !item.disabled ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, item)}
              onClick={(event) => {
                if (item.disabled) {
                  event.preventDefault();
                  return;
                }
                onValueChange?.(item.id);
              }}
              className={cn(
                'group relative z-10 inline-flex touch-manipulation select-none items-center justify-center whitespace-nowrap rounded-full border-0 bg-transparent font-medium leading-none tracking-[-0.01em] text-muted-foreground transition-[color,background-color,box-shadow,transform] duration-150 ease-out [-webkit-tap-highlight-color:transparent] after:pointer-events-none after:absolute after:inset-0.5 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:shadow-[0_0_0_3px_hsl(var(--foreground)/0.16)] motion-reduce:transition-none',
                viewportFill
                  ? 'h-16 min-w-0 flex-1 basis-0 flex-col gap-1 px-0.5 text-[10.5px]'
                  : 'h-12 shrink-0 gap-0 px-2 text-[11px] min-[360px]:px-2.5 min-[360px]:text-xs min-[430px]:gap-1 min-[430px]:px-[7px] min-[430px]:text-[11.5px] sm:gap-[9px] sm:px-[22px] sm:text-sm',
                active
                  ? 'text-foreground'
                  : 'hover:bg-background/45 hover:text-foreground/75 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]',
                item.disabled &&
                  'cursor-not-allowed text-muted-foreground/35 hover:bg-transparent hover:text-muted-foreground/35 hover:shadow-none',
                !item.disabled && 'active:translate-y-px',
              )}
            >
              {showIcons && item.icon ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'shrink-0 text-muted-foreground/70 transition-colors duration-150 group-hover:text-muted-foreground motion-reduce:transition-none [&>svg]:stroke-[1.7]',
                    viewportFill
                      ? 'inline-flex [&>svg]:h-[18px] [&>svg]:w-[18px]'
                      : 'hidden min-[430px]:inline-flex [&>svg]:h-[15px] [&>svg]:w-[15px] sm:[&>svg]:h-[17px] sm:[&>svg]:w-[17px]',
                    active && 'text-foreground/85',
                  )}
                >
                  {item.icon}
                </span>
              ) : null}

              <span className={cn(viewportFill && 'max-w-full truncate')}>{item.label}</span>

              {item.badge !== undefined && item.badge !== null ? (
                <span
                  aria-label={item.badgeLabel}
                  className={cn(
                    'absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground/[0.06] px-1 text-[8px] font-semibold leading-none text-muted-foreground sm:static sm:h-[18px] sm:min-w-[18px] sm:px-[5px] sm:text-[10px]',
                    active && 'bg-foreground/[0.075] text-foreground/75',
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
