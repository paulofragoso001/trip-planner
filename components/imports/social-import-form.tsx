"use client";

import { Clipboard, FileText, Upload, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { WaylineSampleKey } from "@/lib/wayline-onboarding";

type SocialImportFormProps = {
  defaultRawText?: string;
  sampleKey?: WaylineSampleKey;
  trips: Array<{ id: string; name: string }>;
};

export function SocialImportForm({
  defaultRawText,
  sampleKey,
  trips
}: SocialImportFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const rawTextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!rawTextRef.current) return;
    if (defaultRawText || window.location.hash === "#saved-inspiration") {
      rawTextRef.current.focus();
      rawTextRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [defaultRawText]);

  async function submit(formData: FormData) {
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    const hasText = ["sourceUrl", "rawText", "sourceCaption", "sourceTitle"].some((key) => {
      const value = formData.get(key);
      return typeof value === "string" && Boolean(value.trim());
    });

    if (!hasFile && !hasText) {
      setMessage("Paste a link, add notes, or upload a screenshot first.");
      return;
    }

    setPending(true);
    setMessage("Scanning travel save...");
    formData.set("hasFile", hasFile ? "true" : "false");
    if (hasFile) {
      formData.set("sourcePlatform", "screenshot");
    }

    try {
      const response = await fetch("/api/social-imports", {
        body: formData,
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const partialCount = countExtractedPlaces(payload);
        if (partialCount) {
          setMessage(
            `Wayline found ${partialCount} place${
              partialCount === 1 ? "" : "s"
            }, but Wayline returned a warning: ${readError(payload, response.status)}`
          );
          router.refresh();
          return;
        }

        throw new Error(readError(payload, response.status));
      }

      const count = countExtractedPlaces(payload);
      setMessage(
        count
          ? `Wayline found ${count} place${count === 1 ? "" : "s"} to review.`
          : "Scan finished. Add a caption or screenshot if no places appeared."
      );
      router.refresh();
      window.setTimeout(() => {
        document.getElementById("ai-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import inspiration.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="grid gap-4">
      <div className="grid gap-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300/80 lg:text-slate-500">
          Capture travel inspiration
        </p>

        {defaultRawText ? (
          <div className="rounded-2xl bg-blue-400/15 px-4 py-3 text-sm font-semibold text-blue-50 ring-1 ring-blue-200/20 lg:bg-blue-50 lg:text-blue-900 lg:ring-blue-200">
            Sample inspiration loaded{sampleKey ? `: ${sampleKey}` : ""}. Edit it if you want, then tap Find places.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid min-h-24 cursor-text content-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-[0_12px_34px_rgba(0,0,0,0.18)] focus-within:border-orange-300/40 lg:border-slate-200 lg:bg-white lg:shadow-sm lg:focus-within:border-slate-400">
            <span className="flex items-center gap-2 text-sm font-black text-white lg:text-slate-950">
              <Clipboard className="h-4 w-4 text-orange-300 lg:text-blue-600" />
              Paste link
            </span>
            <span className="text-xs font-semibold text-white/52 lg:text-slate-500">Instagram, TikTok, YouTube, Pinterest</span>
          </label>
          <label className="grid min-h-24 cursor-pointer content-center gap-2 rounded-2xl border border-dashed border-white/18 bg-white/[0.04] px-4 py-3 shadow-[0_12px_34px_rgba(0,0,0,0.18)] lg:border-slate-300 lg:bg-white lg:shadow-sm">
            <span className="flex items-center gap-2 text-sm font-black text-white lg:text-slate-950">
              <Upload className="h-4 w-4 text-orange-300 lg:text-blue-600" />
              Upload screenshot
            </span>
            <span className="text-xs font-semibold text-white/52 lg:text-slate-500">OCR-ready image import</span>
            <input accept="image/*" className="sr-only" name="file" type="file" />
          </label>
          <label className="grid min-h-24 cursor-text content-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-[0_12px_34px_rgba(0,0,0,0.18)] focus-within:border-orange-300/40 lg:border-slate-200 lg:bg-white lg:shadow-sm lg:focus-within:border-slate-400">
            <span className="flex items-center gap-2 text-sm font-black text-white lg:text-slate-950">
              <FileText className="h-4 w-4 text-orange-300 lg:text-blue-600" />
              Paste caption
            </span>
            <span className="text-xs font-semibold text-white/52 lg:text-slate-500">Notes, hashtags, itinerary text</span>
          </label>
        </div>

        <div className="grid gap-3">
          <input
            className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-base text-white outline-none placeholder:text-white/40 focus:border-orange-300/40 lg:border-slate-200 lg:bg-white lg:text-slate-950 lg:placeholder:text-slate-400 lg:focus:border-slate-400"
            name="sourceUrl"
            placeholder="Paste Instagram, TikTok, YouTube, Pinterest, or article URL"
            type="url"
          />
          <textarea
            className="min-h-32 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base text-white outline-none placeholder:text-white/40 focus:border-orange-300/40 lg:border-slate-200 lg:bg-white lg:text-slate-950 lg:placeholder:text-slate-400 lg:focus:border-slate-400"
            defaultValue={defaultRawText || ""}
            name="rawText"
            placeholder="Paste caption, notes, or visible text from a post"
            ref={rawTextRef}
          />
        </div>
      </div>

      <div className="grid gap-3">
        <select
          className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-white outline-none focus:border-orange-300/40 lg:border-slate-200 lg:bg-white lg:text-slate-700 lg:focus:border-slate-400"
          name="tripId"
        >
          <option className="bg-slate-950 text-white lg:bg-white lg:text-slate-950" value="">No trip yet</option>
          {trips.map((trip) => (
            <option className="bg-slate-950 text-white lg:bg-white lg:text-slate-950" key={trip.id} value={trip.id}>
              {trip.name}
            </option>
          ))}
        </select>
      </div>

      <input name="processNow" type="hidden" value="true" />
      <button
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 text-base font-black text-white shadow-[0_14px_34px_rgba(249,115,22,0.22)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60 lg:bg-slate-950 lg:hover:bg-slate-800"
        disabled={pending}
        type="submit"
      >
        <WandSparkles className="h-4 w-4" />
        {pending ? "Scanning..." : "Find places"}
      </button>
      {pending ? (
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-white/10 lg:bg-slate-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-orange-400 lg:bg-blue-600" />
        </div>
      ) : null}
      {message ? (
        <p aria-live="polite" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white/76 lg:bg-slate-50 lg:text-slate-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function readError(payload: unknown, status: number) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return `Import failed (${status}).`;
}

function countExtractedPlaces(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    typeof payload.data === "object" &&
    payload.data !== null &&
    "extractedPlaces" in payload.data &&
    Array.isArray(payload.data.extractedPlaces)
  ) {
    return payload.data.extractedPlaces.length;
  }

  return 0;
}
