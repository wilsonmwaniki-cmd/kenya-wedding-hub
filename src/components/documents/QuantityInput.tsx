import { useEffect, useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import {
  formatNonNegativeNumberInputText,
  formatNonNegativeNumberInputValue,
  parseNonNegativeNumberInput,
} from '@/lib/nonNegativeNumberInput';

type Props = Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
};

export default function QuantityInput({ value, onValueChange, onBlur, onFocus, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(() => formatNonNegativeNumberInputValue(value));

  useEffect(() => {
    if (!focused) setDisplayValue(formatNonNegativeNumberInputValue(value));
  }, [focused, value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={props.placeholder ?? '0'}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = formatNonNegativeNumberInputText(event.target.value);
        setDisplayValue(next);
        onValueChange(parseNonNegativeNumberInput(next));
      }}
      onBlur={(event) => {
        setFocused(false);
        setDisplayValue(formatNonNegativeNumberInputValue(value));
        onBlur?.(event);
      }}
    />
  );
}
