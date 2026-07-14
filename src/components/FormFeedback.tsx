export function FormFieldError({ message }: { message?: string | null }) {
  if (!message) return null;

  return <p role="alert" className="animate-in fade-in slide-in-from-top-1 text-sm text-destructive duration-200 motion-reduce:animate-none">{message}</p>;
}

export function FormSubmitError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div role="alert" className="animate-in fade-in slide-in-from-top-1 rounded-xl border border-[hsl(var(--destructive-soft-border))] bg-[hsl(var(--destructive-soft))] px-4 py-3 text-sm text-destructive duration-200 motion-reduce:animate-none">
      {message}
    </div>
  );
}
