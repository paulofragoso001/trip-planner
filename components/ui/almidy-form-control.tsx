import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/components/trip-ui";

const ordinaryControlClassName =
  "min-h-11 rounded-xl border border-almidy-border-subtle px-3 aria-invalid:border-red-500";

export const AlmidyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function AlmidyInput({ className, ...props }, ref) {
    return <input className={cn(ordinaryControlClassName, className)} ref={ref} {...props} />;
  },
);

export const AlmidySelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function AlmidySelect({ className, ...props }, ref) {
    return (
      <select
        className={cn(ordinaryControlClassName, "bg-white", className)}
        ref={ref}
        {...props}
      />
    );
  },
);
