"use client";

import { useEffect, useRef, useState } from "react";

type MobileHomeGlobeProps = {
  className?: string;
};

export function MobileHomeGlobe({ className }: MobileHomeGlobeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduceMotion(media.matches);

    syncMotion();
    media.addEventListener("change", syncMotion);
    const frame = window.requestAnimationFrame(() => setEnhanced(true));

    return () => {
      media.removeEventListener("change", syncMotion);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;

    if (!root || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.1 }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const animated = enhanced && !reduceMotion && visible;

  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none absolute inset-0 overflow-hidden bg-[#020916]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="mobile-home-globe"
      ref={rootRef}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-12%,rgba(45,212,191,0.22),transparent_32%),radial-gradient(circle_at_82%_14%,rgba(37,99,235,0.18),transparent_32%),linear-gradient(180deg,rgba(2,9,22,0.08),#020916_84%)]" />
      <div
        className={[
          "wayline-globe-sphere absolute left-1/2 top-[8%] h-[72vw] max-h-[520px] min-h-[320px] w-[72vw] min-w-[320px] max-w-[520px] -translate-x-1/2 rounded-full opacity-95 shadow-[0_0_90px_rgba(20,184,166,0.18),inset_-42px_-46px_80px_rgba(0,0,0,0.62),inset_30px_24px_70px_rgba(125,211,252,0.13)]",
          animated ? "wayline-globe-drift" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_42%_34%,rgba(74,222,128,0.36),transparent_8%),radial-gradient(circle_at_60%_46%,rgba(20,184,166,0.3),transparent_12%),radial-gradient(circle_at_33%_55%,rgba(34,197,94,0.24),transparent_10%),radial-gradient(circle_at_66%_31%,rgba(45,212,191,0.2),transparent_9%),radial-gradient(circle_at_47%_69%,rgba(74,222,128,0.16),transparent_12%),radial-gradient(circle_at_48%_48%,#0d3340,#071a31_42%,#031024_72%,#010814)]" />
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[length:44px_44px] opacity-45 [mask-image:radial-gradient(circle,black_58%,transparent_72%)]" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.22),transparent_18%),radial-gradient(circle_at_50%_50%,transparent_52%,rgba(2,6,23,0.84)_78%)]" />
      </div>
      <div className="absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(2,9,22,0.92),transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-[54%] bg-[linear-gradient(180deg,transparent,rgba(2,9,22,0.72)_28%,#020916_76%)]" />
      <div
        className={[
          "wayline-orbit-line absolute left-1/2 top-[28%] h-[34vw] max-h-[240px] min-h-[150px] w-[86vw] max-w-[640px] min-w-[380px] -translate-x-1/2 rounded-[999px] border border-cyan-200/16 opacity-60",
          animated ? "wayline-orbit-drift" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      />
    </div>
  );
}
