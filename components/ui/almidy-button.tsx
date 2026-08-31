import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/components/trip-ui";

type AlmidyButtonVariant = "primary" | "neutral";
type AlmidyButtonSize = "standard" | "compact";

export type AlmidyButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: AlmidyButtonSize;
  variant?: AlmidyButtonVariant;
};

const variantClasses: Record<AlmidyButtonVariant, string> = {
  primary:
    "bg-almidy-accent text-almidy-action text-almidy-text-primary transition hover:bg-almidy-accent-pressed active:bg-almidy-accent-pressed focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60",
  neutral:
    "bg-slate-950 text-sm font-bold text-white focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50",
};

const sizeClasses: Record<AlmidyButtonSize, string> = {
  compact: "px-4 py-2",
  standard: "min-h-12 px-4 py-3",
};

export const AlmidyButton = forwardRef<HTMLButtonElement, AlmidyButtonProps>(
  function AlmidyButton(
    { className, size = "standard", variant = "primary", ...props },
    ref,
  ) {
    return (
      <button
        className={cn("rounded-xl", variantClasses[variant], sizeClasses[size], className)}
        ref={ref}
        {...props}
      />
    );
  },
);
