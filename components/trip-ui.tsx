import { forwardRef } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const tripUi = {
  page: "bg-[#f7f6f2] text-[#221d17]",
  card: {
    surface: "rounded-3xl border border-black/10 bg-white shadow-panel",
    surfaceSoft: "rounded-3xl border border-black/10 bg-white shadow-sm",
    inset: "rounded-2xl border border-black/10 bg-[#f7f6f2]",
    nested: "rounded-2xl bg-white ring-1 ring-black/10"
  },
  text: {
    eyebrow: "text-xs font-bold uppercase tracking-[0.12em] text-[#8a8175]",
    bodyMuted: "text-[#6f675c]",
    bodySoft: "text-[#5f574d]",
    heading: "font-black text-[#221d17]"
  },
  button: {
    primary:
      "rounded-full bg-brand px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
    primaryCompact:
      "rounded-full bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700",
    secondary:
      "rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#faf8f5]",
    subtle:
      "rounded-full border border-black/10 bg-[#faf8f5] px-4 py-2 text-sm font-bold text-[#5f574d] transition hover:bg-[#f1ede7]",
    danger:
      "rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
  }
} as const;

type TripCardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div" | "header";
  variant?: "surface" | "surfaceSoft" | "inset" | "nested";
  children: ReactNode;
};

export function TripCard({
  as: Component = "div",
  variant = "surface",
  className,
  children,
  ...props
}: TripCardProps) {
  return (
    <Component className={cn(tripUi.card[variant], className)} {...props}>
      {children}
    </Component>
  );
}

type TripEyebrowProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

export function TripEyebrow({ className, children, ...props }: TripEyebrowProps) {
  return (
    <p className={cn(tripUi.text.eyebrow, className)} {...props}>
      {children}
    </p>
  );
}

type TripButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "primaryCompact" | "secondary" | "subtle" | "danger";
};

export const TripButton = forwardRef<HTMLButtonElement, TripButtonProps>(
  function TripButton(
    {
      variant = "secondary",
      className,
      type = "button",
      children,
      ...props
    },
    ref
  ) {
    return (
      <button
        className={cn(tripUi.button[variant], className)}
        ref={ref}
        type={type}
        {...props}
      >
        {children}
      </button>
    );
  }
);
