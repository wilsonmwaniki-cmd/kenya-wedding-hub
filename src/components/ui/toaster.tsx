import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

function getToastTone(variant?: string) {
  switch (variant) {
    case "info":
      return {
        icon: Info,
        chipClassName: "border-[hsl(var(--info-soft-border))] bg-[hsl(var(--info-soft))] text-info",
      };
    case "success":
      return {
        icon: CheckCircle2,
        chipClassName: "border-[hsl(var(--success-soft-border))] bg-[hsl(var(--success-soft))] text-success",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        chipClassName: "border-[hsl(var(--warning-soft-border))] bg-[hsl(var(--warning-soft))] text-warning",
      };
    case "destructive":
      return {
        icon: XCircle,
        chipClassName: "border-[hsl(var(--destructive-soft-border))] bg-[hsl(var(--destructive-soft))] text-destructive",
      };
    default:
      return {
        icon: Info,
        chipClassName: "border-primary/15 bg-primary/8 text-primary",
      };
  }
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const tone = getToastTone(variant);
        const Icon = tone.icon;

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${tone.chipClassName}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="grid gap-1 pt-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
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
