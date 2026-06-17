"use client";

import { Languages, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import TripMap, { type TripMapItem } from "@/components/TripMap";

type DisplayAddressSheetProps = {
  address: string;
  mapItem: TripMapItem | null;
  onClose: () => void;
  title: string;
};

export function DisplayAddressSheet({
  address,
  mapItem,
  onClose,
  title
}: DisplayAddressSheetProps) {
  const [speechSupported, setSpeechSupported] = useState(false);
  const displayAddress = useMemo(() => formatDisplayAddress(address), [address]);

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        "SpeechSynthesisUtterance" in window
    );
  }, []);

  useEffect(() => {
    const { overflow, overscrollBehavior } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      document.body.style.overflow = overflow;
      document.body.style.overscrollBehavior = overscrollBehavior;
    };
  }, []);

  function speakAddress() {
    if (!speechSupported) return;
    const utterance = new window.SpeechSynthesisUtterance(`${title}. ${address}`);
    utterance.lang = navigator.language || "en-US";
    utterance.rate = 0.92;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[2147483647] isolate overflow-hidden bg-black text-white"
      data-testid="display-address-sheet"
      role="dialog"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(249,115,22,0.16),transparent_28%),linear-gradient(145deg,#04070c_0%,#05070b_52%,#000_100%)]" />
      <div className="relative flex h-full flex-col gap-5 px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] landscape:grid landscape:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] landscape:items-center landscape:gap-8 landscape:px-10 landscape:py-8">
        <button
          aria-label="Close display address"
          className="absolute right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white/72 ring-1 ring-white/10"
          onClick={onClose}
          type="button"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <section className="flex min-h-0 flex-1 flex-col justify-center landscape:flex-none">
          <p
            className="max-w-[calc(100%-4rem)] text-lg font-black leading-tight text-white/48 landscape:text-xl"
            data-testid="display-address-title"
          >
            {title}
          </p>
          <h1
            className="mt-5 whitespace-pre-line text-[clamp(2.7rem,11vw,5.5rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-white landscape:text-[clamp(2.6rem,6vw,5rem)]"
            data-testid="display-address-text"
          >
            {displayAddress}
          </h1>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-orange-500 px-5 text-base font-black text-white shadow-xl shadow-orange-950/25 disabled:opacity-45"
              data-testid="display-address-speak"
              disabled={!speechSupported}
              onClick={speakAddress}
              type="button"
            >
              <Volume2 className="h-5 w-5" aria-hidden="true" />
              Speak
            </button>
            <button
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-orange-500/90 px-5 text-base font-black text-white shadow-xl shadow-orange-950/25 disabled:opacity-45"
              data-testid="display-address-translate"
              disabled
              title="Translation support is not available yet."
              type="button"
            >
              <Languages className="h-5 w-5" aria-hidden="true" />
              Translate
            </button>
          </div>
        </section>

        {mapItem ? (
          <section
            aria-label="Address map preview"
            className="min-h-[220px] overflow-hidden rounded-[1.75rem] bg-[#111318] shadow-2xl ring-1 ring-white/14 landscape:h-[min(74vh,430px)] landscape:min-h-0"
            data-testid="display-address-map"
          >
            <TripMap
              height="100%"
              items={[mapItem]}
              mapTheme="default"
              selectedId={mapItem.id}
              showRouteDetails={false}
              travelMode="WALKING"
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function formatDisplayAddress(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(",\n");
}
