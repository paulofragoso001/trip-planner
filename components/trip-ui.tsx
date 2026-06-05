import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const tripUi = {
  page: "bg-[radial-gradient(circle_at_14%_0%,rgba(37,99,235,0.08),transparent_28%),linear-gradient(180deg,#f8fafc,#f1f5f9)] text-slate-950",
  card: {
    surface: "rounded-[2rem] border border-slate-200/80 bg-white shadow-sm",
    surfaceSoft: "rounded-[1.75rem] border border-slate-200/80 bg-white shadow-sm",
    inset: "rounded-[1.5rem] border border-slate-200/80 bg-slate-50",
    nested: "rounded-[1.35rem] bg-white ring-1 ring-slate-200/80",
    walletDark:
      "rounded-[2rem] bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(135deg,#020617,#172554_52%,#0f766e)] text-white shadow-2xl",
    walletGlass:
      "rounded-full bg-white/16 px-3 py-1 text-xs font-black text-white ring-1 ring-white/18 backdrop-blur",
    preview:
      "rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
  },
  text: {
    eyebrow: "text-xs font-black uppercase tracking-[0.18em] text-blue-600",
    micro: "text-xs font-black uppercase tracking-[0.18em] text-slate-400",
    bodyMuted: "text-slate-600",
    bodySoft: "text-slate-500",
    heading: "font-black text-slate-950"
  },
  button: {
    primary:
      "min-h-11 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60",
    primaryCompact:
      "min-h-11 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800",
    secondary:
      "min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-50",
    subtle:
      "min-h-11 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200",
    danger:
      "min-h-11 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
  }
} as const;

type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  eyebrow?: string;
  subtitle?: ReactNode;
  title: ReactNode;
};

export function PageHeader({
  actions,
  className,
  eyebrow,
  subtitle,
  title,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "grid gap-4 rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end",
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className={tripUi.text.eyebrow}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:mt-3 sm:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">{actions}</div> : null}
    </header>
  );
}

type SectionCardProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  title?: ReactNode;
};

export function SectionCard({
  actions,
  children,
  className,
  description,
  eyebrow,
  title,
  ...props
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-5",
        className
      )}
      {...props}
    >
      {title || eyebrow || description || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? (
              <p className={tripUi.text.eyebrow}>
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ActionCard({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        "group rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "blue" | "green" | "amber" | "red" | "slate" | "purple";
};

const statusBadgeTones = {
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-blue-50 text-blue-800 ring-blue-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  purple: "bg-violet-50 text-violet-800 ring-violet-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200"
};

export function StatusBadge({
  children,
  className,
  tone = "slate",
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-black ring-1",
        statusBadgeTones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  description: ReactNode;
  title: ReactNode;
};

export function EmptyState({
  action,
  className,
  description,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-600",
        className
      )}
      {...props}
    >
      <p className="font-black text-slate-950">{title}</p>
      <p className="mt-1 max-w-2xl leading-6">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

type ErrorStateProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  message: ReactNode;
  title?: ReactNode;
};

export function ErrorState({
  action,
  className,
  message,
  title = "Something went wrong.",
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-900",
        className
      )}
      role="alert"
      {...props}
    >
      <p className="font-black">{title}</p>
      <p className="mt-1 max-w-2xl leading-6">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

type InlineAlertProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "amber" | "blue" | "red" | "green";
};

const alertTones = {
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  blue: "bg-blue-50 text-blue-900 ring-blue-200",
  green: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  red: "bg-rose-50 text-rose-900 ring-rose-200"
};

export function InlineAlert({
  children,
  className,
  tone = "blue",
  ...props
}: InlineAlertProps) {
  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-3 text-sm font-semibold ring-1",
        alertTones[tone],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type StepperProps = {
  steps: Array<{ description?: string; label: string }>;
};

export function Stepper({ steps }: StepperProps) {
  return (
    <ol className="grid grid-cols-3 gap-2 md:gap-3">
      {steps.map((step, index) => (
        <li
          className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm sm:grid-cols-[44px_minmax(0,1fr)] sm:gap-3 sm:p-4 sm:text-left"
          key={step.label}
        >
          <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-sm font-black text-white sm:mx-0 sm:h-11 sm:w-11 sm:rounded-2xl">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-slate-950 sm:text-base">{step.label}</span>
            {step.description ? (
              <span className="mt-1 hidden text-sm leading-6 text-slate-600 sm:block">
                {step.description}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export const StepIndicator = Stepper;

type ResponsiveTabsProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ResponsiveTabs({ children, className, ...props }: ResponsiveTabsProps) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PrimaryCTA({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

type LoadingStateProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
};

export function LoadingState({ className, label, ...props }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700",
        className
      )}
      {...props}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

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
