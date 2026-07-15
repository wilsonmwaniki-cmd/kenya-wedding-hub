import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  format?: (value: number) => string;
}

export default function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  className,
  format = (nextValue) => Math.round(nextValue).toLocaleString(),
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const startValue = previousValue.current;
    previousValue.current = value;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || startValue === value) {
      setDisplayValue(value);
      return;
    }

    const duration = 360;
    const startedAt = performance.now();
    let animationFrame = 0;

    const update = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (value - startValue) * easedProgress);

      if (progress < 1) animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, [value]);

  return (
    <span className={className} aria-label={`${prefix}${format(value)}${suffix}`}>
      <span aria-hidden="true">{prefix}{format(displayValue)}{suffix}</span>
    </span>
  );
}
