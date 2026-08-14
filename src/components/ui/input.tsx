import * as React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const inputClassName = "ease-zania flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 focus-visible:ring-offset-0 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10 data-[valid=true]:border-success/60 data-[valid=true]:bg-[hsl(var(--success-soft))] data-[valid=true]:ring-4 data-[valid=true]:ring-success/10 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:text-sm";

function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: unknown) {
  const parsed = parseIsoDate(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

interface ZaniaDateInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  forwardedRef: React.ForwardedRef<HTMLInputElement>;
}

function ZaniaDateInput({
  forwardedRef,
  className,
  value,
  defaultValue,
  onChange,
  disabled,
  required,
  id,
  name,
  min,
  max,
  placeholder,
  ...props
}: ZaniaDateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
    typeof defaultValue === "string" || typeof defaultValue === "number" ? String(defaultValue) : "",
  );
  const internalInputRef = React.useRef<HTMLInputElement | null>(null);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : uncontrolledValue;
  const selected = parseIsoDate(currentValue);
  const minimumDate = parseIsoDate(min);
  const maximumDate = parseIsoDate(max);
  const displayValue = formatDisplayDate(currentValue);

  const setInputRef = React.useCallback((node: HTMLInputElement | null) => {
    internalInputRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  const updateValue = (nextValue: string) => {
    const input = internalInputRef.current;
    if (!input) return;

    if (!isControlled) setUncontrolledValue(nextValue);
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, nextValue);
    onChange?.({ target: input, currentTarget: input } as React.ChangeEvent<HTMLInputElement>);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-required={required}
          aria-haspopup="dialog"
          aria-label={props["aria-label"] || (displayValue ? `Selected date ${displayValue}` : placeholder || "Choose date")}
          className={cn(inputClassName, "justify-between text-left font-normal", !displayValue && "text-muted-foreground", className)}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary/80" aria-hidden="true" />
            <span>{displayValue || placeholder || "dd/mm/yyyy"}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[22rem] gap-0 overflow-y-auto border-border/70 bg-popover p-0 shadow-[0_18px_50px_rgba(47,34,29,0.14)] sm:p-0">
        <DialogHeader className="border-b border-border/60 bg-primary/[0.035] px-4 py-3 pr-12 text-left">
          <DialogTitle className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Choose a date</DialogTitle>
          <DialogDescription className="mt-1 text-sm normal-case tracking-normal">Displayed as day / month / year</DialogDescription>
        </DialogHeader>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minimumDate ?? new Date()}
          onSelect={(date) => {
            if (date) updateValue(toIsoDate(date));
          }}
          fromDate={minimumDate}
          toDate={maximumDate}
          initialFocus
          className="mx-auto p-3 sm:p-4"
        />
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-sm">
          <button type="button" className="text-muted-foreground transition-colors hover:text-foreground" onClick={() => updateValue(toIsoDate(new Date()))}>
            Today
          </button>
          {selected ? (
            <button type="button" className="text-primary transition-colors hover:text-primary/75" onClick={() => updateValue("")}>
              Clear date
            </button>
          ) : null}
        </div>
      </DialogContent>
      <input
        {...props}
        ref={setInputRef}
        type="date"
        name={name}
        {...(isControlled
          ? { value: typeof value === "string" || typeof value === "number" ? value : "" }
          : { defaultValue })}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </Dialog>
  );
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    if (type === "date") {
      return <ZaniaDateInput {...props} className={className} forwardedRef={ref} />;
    }

    return (
      <input
        type={type}
        className={cn(
          inputClassName,
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
