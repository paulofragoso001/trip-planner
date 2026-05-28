"use client";

import { Clipboard, FileText, Upload, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SocialImportFormProps = {
  trips: Array<{ id: string; name: string }>;
};

export function SocialImportForm({ trips }: SocialImportFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage("Scanning travel save with OpenAI...");

    try {
      const response = await fetch("/api/social-imports", {
        body: formData,
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readError(payload, response.status));
      }

      const count = countExtractedPlaces(payload);
      setMessage(
        count
          ? `OpenAI created ${count} review candidate${count === 1 ? "" : "s"}.`
          : "Scan finished. Add a caption or screenshot if no places appeared."
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import inspiration.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="grid gap-4">
      <div className="grid gap-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Capture travel inspiration
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid min-h-24 cursor-text content-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-slate-400">
            <span className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Clipboard className="h-4 w-4 text-blue-600" />
              Paste link
            </span>
            <span className="text-xs font-semibold text-slate-500">Instagram, TikTok, YouTube, Pinterest</span>
          </label>
          <label className="grid min-h-24 cursor-pointer content-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 shadow-sm">
            <span className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Upload className="h-4 w-4 text-blue-600" />
              Upload screenshot
            </span>
            <span className="text-xs font-semibold text-slate-500">OCR-ready image import</span>
            <input accept="image/*" className="sr-only" name="file" type="file" />
          </label>
          <label className="grid min-h-24 cursor-text content-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-slate-400">
            <span className="flex items-center gap-2 text-sm font-black text-slate-950">
              <FileText className="h-4 w-4 text-blue-600" />
              Paste caption
            </span>
            <span className="text-xs font-semibold text-slate-500">Notes, hashtags, itinerary text</span>
          </label>
        </div>

        <div className="grid gap-3">
          <input
            className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-slate-400"
            name="sourceUrl"
            placeholder="Paste Instagram, TikTok, YouTube, Pinterest, or article URL"
            type="url"
          />
          <textarea
            className="min-h-32 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-slate-400"
            name="rawText"
            placeholder="Paste caption, notes, or visible text from a post"
          />
        </div>
      </div>

      <div className="grid gap-3">
        <select
          className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-slate-400"
          name="tripId"
        >
          <option value="">No trip yet</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name}
            </option>
          ))}
        </select>
      </div>

      <input name="processNow" type="hidden" value="true" />
      <button
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-base font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        <WandSparkles className="h-4 w-4" />
        {pending ? "Scanning..." : "Scan with OpenAI"}
      </button>
      {pending ? (
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
        </div>
      ) : null}
      {message ? (
        <p aria-live="polite" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
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
