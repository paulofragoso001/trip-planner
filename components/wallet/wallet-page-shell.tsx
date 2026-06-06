import type { ReactNode } from "react";
import { cn } from "@/components/trip-ui";

export type WalletPageHeroImage = {
  alt?: string | null;
  attribution?: string | null;
  imageAlt?: string | null;
  imageAttribution?: string | null;
  imageSourceLabel?: string | null;
  imageUrl?: string | null;
  providerPhotoName?: string | null;
  src?: string | null;
};

type WalletPageShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  compactHero?: boolean;
  eyebrow?: string;
  fallbackGradient?: string;
  heroImage?: WalletPageHeroImage | null;
  subtitle?: ReactNode;
  title: string;
  variant?: "public" | "app" | "trip";
};

export function WalletPageShell({
  actions,
  children,
  compactHero = false,
  eyebrow,
  fallbackGradient = "bg-[linear-gradient(135deg,#172554,#0f766e_55%,#111827)]",
  heroImage,
  subtitle,
  title,
  variant = "app"
}: WalletPageShellProps) {
  const imageUrl = heroImage?.src || heroImage?.imageUrl || null;
  const attribution = heroImage?.attribution || heroImage?.imageAttribution || heroImage?.imageSourceLabel || null;
  const imageAlt = heroImage?.alt || heroImage?.imageAlt || `${title} background`;

  return (
    <div
      className={cn(
        "relative isolate -mx-3 -mt-4 overflow-hidden sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-my-6",
        variant === "public" ? "bg-white" : "bg-slate-950"
      )}
      data-testid="wallet-page-shell"
    >
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        {imageUrl ? (
          <img
            alt=""
            className="h-full w-full scale-105 object-cover opacity-72 blur-sm"
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <div className={`h-full w-full ${fallbackGradient}`} />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.2),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.24),rgba(2,6,23,0.82)_48%,rgba(244,247,251,0.98)_86%)]" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1180px] gap-3 px-3 py-3 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-8">
        <section
          className={cn(
            "relative isolate overflow-hidden rounded-[2.35rem] bg-slate-950 text-white shadow-[0_26px_80px_rgba(2,6,23,0.28)] ring-1 ring-white/20",
            compactHero ? "min-h-[15rem]" : "min-h-[18rem] sm:min-h-[22rem]"
          )}
          data-has-image={imageUrl ? "true" : "false"}
          data-testid="wallet-page-hero"
        >
          {imageUrl ? (
            <img
              alt={imageAlt}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              src={imageUrl}
            />
          ) : (
            <div className={`absolute inset-0 ${fallbackGradient}`} />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(135deg,rgba(2,6,23,0.18),rgba(2,6,23,0.86)_62%,rgba(2,6,23,0.94))]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/72 via-black/24 to-transparent" />
          <div className="relative grid min-h-[inherit] content-between gap-6 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {eyebrow ? (
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-white/62">
                    {eyebrow}
                  </p>
                ) : null}
              </div>
              {actions ? <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div> : null}
            </div>

            <div className="max-w-3xl">
              <h1 className="break-words text-4xl font-black leading-[0.94] tracking-tight sm:text-6xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-white/76 sm:text-base">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {imageUrl && attribution ? (
              <p className="absolute bottom-4 right-4 max-w-[14rem] truncate rounded-full bg-black/34 px-3 py-1 text-[0.66rem] font-bold text-white/78 backdrop-blur">
                Photo: {attribution}
              </p>
            ) : null}
          </div>
        </section>

        <main className="rounded-[2.35rem] bg-white/96 p-3 shadow-[0_20px_70px_rgba(15,23,42,0.16)] ring-1 ring-white/70 backdrop-blur-2xl sm:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
