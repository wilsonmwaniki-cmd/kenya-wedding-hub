export function FormFieldError({ message }: { message?: string | null }) {
  if (!message) return null;

  return <p className="text-sm text-destructive">{message}</p>;
}

export function FormSubmitError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}
