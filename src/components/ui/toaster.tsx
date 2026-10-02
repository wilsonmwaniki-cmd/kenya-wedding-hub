import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

function inferToastVariant(variant: string | null | undefined, title: unknown) {
  if (variant && variant !== "default") return variant;
  if (typeof title !== "string") return "info";

  const normalizedTitle = title.toLowerCase();
  if (/could not|couldn't|failed|failure|error|unable|not saved/.test(normalizedTitle)) return "destructive";
  if (/pending|waiting|locked|unavailable|invalid|required|choose|already/.test(normalizedTitle)) return "warning";
  if (/saved|updated|added|created|copied|sent|complete|completed|submitted|requested|removed|archived|accepted|opened|refreshed|ready|linked|uploaded|paid|reopened|posted/.test(normalizedTitle)) return "success";
  return "info";
}

function getToastTone(variant: string) {
  switch (variant) {
    case "info":
      return {
        icon: Info,
        iconClassName: "text-info",
      };
    case "success":
      return {
        icon: CheckCircle2,
        iconClassName: "text-success",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        iconClassName: "text-warning",
      };
    case "destructive":
      return {
        icon: XCircle,
        iconClassName: "text-destructive",
      };
    default:
      return {
        icon: Info,
        iconClassName: "text-info",
      };
  }
}

function getFallbackDescription(variant: string) {
  switch (variant) {
    case "success":
      return "This change is now reflected in your Zania workspace.";
    case "warning":
      return "Review the details before continuing.";
    case "destructive":
      return "Nothing was changed. Review the details and try again.";
    default:
      return null;
  }
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const resolvedVariant = inferToastVariant(variant, title);
        const tone = getToastTone(resolvedVariant);
        const Icon = tone.icon;
        const resolvedDescription = description ?? getFallbackDescription(resolvedVariant);

        return (
          <Toast key={id} variant={resolvedVariant as typeof variant} {...props}>
            <div className="flex items-start gap-3">
              <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${tone.iconClassName}`} strokeWidth={1.8} />
              <div className="grid gap-1 pt-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {resolvedDescription && <ToastDescription>{resolvedDescription}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
