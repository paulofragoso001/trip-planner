"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

type UnfiledItemFormProps = {
  defaultTitle?: string;
};

export function UnfiledItemForm({ defaultTitle = "" }: UnfiledItemFormProps) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState("email");
  const [title, setTitle] = useState(defaultTitle);
  const { isPending, run, state } = useWaylineAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await run({
      body: {
        rawText: title,
        sourceLabel: title,
        sourceType,
        title
      },
      method: "POST",
      timeoutMs: 5000,
      url: "/api/unfiled-items"
    });

    if (result.status === "success") {
      setTitle(defaultTitle);
      router.refresh();
    }
  }

  const message =
    state.status === "success" ? `${title || "Item"} added to review queue.` : state.message;

  return (
    <form className="grid gap-3 rounded-2xl bg-slate-50 px-4 py-3" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-bold text-slate-900">
        Review item
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="United confirmation email"
          required
          value={title}
        />
      </label>
      <select
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        onChange={(event) => setSourceType(event.target.value)}
        value={sourceType}
      >
        <option value="email">Email</option>
        <option value="pdf">PDF</option>
        <option value="photo">Photo</option>
        <option value="screenshot">Screenshot</option>
        <option value="manual">Manual</option>
      </select>
      <button
        className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Adding..." : "Add to review queue"}
      </button>
      {state.status !== "idle" && message ? (
        <p
          aria-live="polite"
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
            state.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : state.status === "error" || state.status === "timeout"
                ? "bg-red-50 text-red-700"
                : "bg-white text-slate-600"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
