"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

export function InviteCollaboratorForm({ tripId }: { tripId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Editor");
  const { isPending, run, state } = useWaylineAction();

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await run({
      body: {
        email,
        role
      },
      timeoutMs: 5000,
      url: `/api/trips/${encodeURIComponent(tripId)}/share`
    });

    if (result.status === "success") {
      setEmail("");
      setRole("Editor");
      return;
    }
  }

  const message =
    state.status === "success" ? "Invite/share settings updated." : state.message;
  const messageTone =
    state.status === "success"
      ? "bg-emerald-50 text-emerald-700"
      : state.status === "error" || state.status === "timeout"
        ? "bg-red-50 text-red-700"
        : "bg-slate-50 text-slate-700";

  return (
    <form className="mt-4 grid gap-3" onSubmit={invite}>
      <input
        className="rounded-2xl border border-slate-200 px-4 py-3"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        value={email}
      />
      <select
        className="rounded-2xl border border-slate-200 px-4 py-3"
        onChange={(event) => setRole(event.target.value)}
        value={role}
      >
        <option>Editor</option>
        <option>Commenter</option>
        <option>Viewer</option>
      </select>
      <button
        className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Sending..." : "Send invite"}
      </button>
      {state.status !== "idle" && message ? (
        <p className={`rounded-2xl px-4 py-3 text-sm font-semibold ${messageTone}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
