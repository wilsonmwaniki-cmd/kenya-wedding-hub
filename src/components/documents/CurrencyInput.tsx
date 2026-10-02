import { useEffect, useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCurrencyInputValue, parseCurrencyInput, sanitizeCurrencyInputText } from '@/lib/currencyInput';

type Props = Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
  currency?: string;
};

export default function CurrencyInput({ value, onValueChange, currency = 'KES', className, onBlur, onFocus, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(() => formatCurrencyInputValue(value));

  useEffect(() => {
    if (!focused) setDisplayValue(formatCurrencyInputValue(value));
  }, [focused, value]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-muted-foreground" aria-hidden="true">
        {currency}
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={displayValue}
        placeholder={props.placeholder ?? '0'}
        className={cn('pl-12 text-right tabular-nums', className)}
        onFocus={(event) => {
          setFocused(true);
          setDisplayValue((current) => sanitizeCurrencyInputText(current));
          onFocus?.(event);
        }}
        onChange={(event) => {
          const next = sanitizeCurrencyInputText(event.target.value);
          setDisplayValue(next);
          onValueChange(parseCurrencyInput(next));
        }}
        onBlur={(event) => {
          setFocused(false);
          setDisplayValue(formatCurrencyInputValue(parseCurrencyInput(displayValue)));
          onBlur?.(event);
        }}
      />
    </div>
  );
}
