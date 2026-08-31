import type { HTMLAttributes } from "react";
import { cn } from "@/components/trip-ui";

export const almidyCardClassName =
  "rounded-[1.75rem] border border-almidy-border-subtle bg-white p-5 shadow-panel";

export function AlmidyCard({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn(almidyCardClassName, className)} {...props} />;
}
