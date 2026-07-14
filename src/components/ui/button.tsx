import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ease-zania inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1rem] text-sm font-medium ring-offset-background transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[#c96f49] bg-[#c96f49] text-[#fff8f1] shadow-[0_16px_32px_-18px_rgba(201,111,73,0.68)] hover:-translate-y-0.5 hover:bg-[#b85f39] hover:shadow-[0_18px_36px_-18px_rgba(184,95,57,0.72)]",
        destructive:
          "border border-destructive bg-destructive text-destructive-foreground shadow-[0_14px_28px_-18px_hsl(var(--destructive)/0.55)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline:
          "border border-[#dfd2c4] bg-[rgba(255,250,244,0.9)] text-[#2b1f1a] shadow-[0_10px_24px_-20px_rgba(43,31,26,0.25)] hover:-translate-y-0.5 hover:border-[#cdb18a] hover:bg-[#fff8f1] hover:text-[#201814]",
        secondary:
          "border border-[#d4bb7d] bg-[#e2c680] text-[#241915] shadow-[0_12px_28px_-18px_rgba(212,187,125,0.65)] hover:-translate-y-0.5 hover:bg-[#d7b76e]",
        ghost:
          "text-[#61483a] hover:bg-[rgba(201,111,73,0.08)] hover:text-[#a95a38]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-[0.9rem] px-3.5",
        lg: "h-12 rounded-[1.1rem] px-8 text-[0.95rem]",
        icon: "h-11 w-11 rounded-[1rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  status?: "idle" | "loading" | "success";
  loadingText?: string;
  successText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, status = "idle", loadingText = "Saving", successText = "Saved", children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} data-status={status} {...props}>
          {children}
        </Slot>
      );
    }

    const Comp = "button";
    const busy = status === "loading";
    const successful = status === "success";

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          successful && "border-success/45 bg-success text-success-foreground hover:bg-success",
        )}
        ref={ref}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        data-status={status}
        {...props}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {successful ? <CheckCircle2 className="animate-in zoom-in-75 duration-200" aria-hidden="true" /> : null}
        {busy || successful ? (
          <span className="transition-opacity duration-150" aria-live="polite">
            {busy ? loadingText : successText}
          </span>
        ) : children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
