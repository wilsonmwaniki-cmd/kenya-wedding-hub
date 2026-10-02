import { useEffect, useRef } from 'react';
import { Bold, Italic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  selection?: { start: number; end: number; requestId: number } | null;
};

export default function MarkdownEditor({ id, value, onChange, onBlur, rows = 8, placeholder, disabled, ariaLabel, selection }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!selection || disabled) return;
    const textarea = ref.current;
    if (!textarea) return;
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selection.start, selection.end);
    });
  }, [disabled, selection]);

  const apply = (before: string, after = before, fallback = 'text') => {
    const textarea = ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <div className="flex items-center gap-1 border-b border-border/70 bg-muted/20 px-2 py-1.5" aria-label="Text formatting">
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2" onClick={() => apply('**')} disabled={disabled} aria-label="Make text bold">
          <Bold className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Bold</span>
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2" onClick={() => apply('*')} disabled={disabled} aria-label="Make text italic">
          <Italic className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Italic</span>
        </Button>
      </div>
      <Textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        className="rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
