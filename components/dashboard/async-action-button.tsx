"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

type AsyncActionButtonProps = {
  body?: unknown;
  children: ReactNode;
  endpoint: string;
  method?: "GET" | "PATCH" | "POST";
  successMessage?: string;
};

export function AsyncActionButton({
  body,
  children,
  endpoint,
  method = "POST",
  successMessage = "Action completed."
}: AsyncActionButtonProps) {
  const router = useRouter();
  const { isPending, run, state } = useWaylineAction();

  async function runAction() {
    const result = await run({
      body: method === "GET" ? undefined : body ?? {},
      method,
      timeoutMs: 5000,
      url: endpoint
    });

    if (result.status === "success") {
      router.refresh();
    }
  }

  const message = state.status === "success" ? successMessage : state.message;
  const messageTone =
    state.status === "success"
      ? "bg-emerald-50 text-emerald-700"
      : state.status === "error" || state.status === "timeout"
        ? "bg-red-50 text-red-700"
        : "bg-white text-slate-600";

  return (
    <div className="grid gap-2">
      <button
        aria-busy={isPending}
        className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={runAction}
        type="button"
      >
        {isPending ? "Working..." : children}
      </button>
      {state.status !== "idle" && message ? (
        <p
          aria-live="polite"
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${messageTone}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
