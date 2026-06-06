import Link from "next/link";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/trip-ui";

type WalletCardVariant = "primary" | "preview" | "utility" | "dark" | "glass" | "empty";

type WalletCardProps = HTMLAttributes<HTMLElement> & {
  action?: ReactNode;
  children: ReactNode;
  eyebrow?: ReactNode;
  href?: string;
  icon?: ReactNode;
  title?: ReactNode;
  variant?: WalletCardVariant;
};

const variantClasses: Record<WalletCardVariant, string> = {
  dark:
    "border-white/10 bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]",
  empty:
    "border-dashed border-slate-300 bg-slate-50 text-slate-700 shadow-none",
  glass:
    "border-white/45 bg-white/72 shadow-sm backdrop-blur-2xl ring-1 ring-white/60",
  preview:
    "border-slate-200 bg-white text-slate-950 shadow-sm transition hover:border-blue-200 hover:shadow-md",
  primary:
    "border-slate-200 bg-white text-slate-950 shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
  utility:
    "border-slate-200 bg-white/96 text-slate-950 shadow-sm"
};

export function WalletCard({
  action,
  children,
  className,
  eyebrow,
  href,
  icon,
  title,
  variant = "primary",
  ...props
}: WalletCardProps) {
  const content = (
    <>
      {eyebrow || title || icon || action ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-full",
                  variant === "dark"
                    ? "bg-white/12 text-white"
                    : "bg-blue-50 text-blue-700"
                )}
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? (
                <p
                  className={cn(
                    "text-xs font-black uppercase tracking-[0.16em]",
                    variant === "dark" ? "text-white/58" : "text-blue-600"
                  )}
                >
                  {eyebrow}
                </p>
              ) : null}
              {title ? (
                <h2
                  className={cn(
                    "mt-1 break-words text-xl font-black leading-tight",
                    variant === "dark" ? "text-white" : "text-slate-950"
                  )}
                >
                  {title}
                </h2>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </>
  );

  const classes = cn(
    "rounded-[2rem] border p-4 sm:p-5",
    variantClasses[variant],
    href ? "focus-within:ring-4 focus-within:ring-blue-100" : undefined,
    className
  );

  if (href) {
    return (
      <Link className={cn(classes, "block focus:outline-none")} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <section className={classes} {...props}>
      {content}
    </section>
  );
}

export function WalletActionLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
