"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  MobileField,
  MobileFormHeader,
  MobileFormSection,
  MobileFormShell,
  mobileInputClassName,
  mobilePrimaryActionClassName,
  mobileSelectClassName
} from "@/components/ui/mobile-form";
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
      ? "bg-emerald-400/12 text-emerald-100 ring-emerald-300/20 lg:bg-emerald-50 lg:text-emerald-700 lg:ring-transparent"
      : state.status === "error" || state.status === "timeout"
        ? "bg-red-400/12 text-red-100 ring-red-300/20 lg:bg-red-50 lg:text-red-700 lg:ring-transparent"
        : "bg-white/[0.06] text-white/70 ring-white/10 lg:bg-slate-50 lg:text-slate-700 lg:ring-transparent";
  const canInvite = Boolean(email.trim()) && !isPending;

  return (
    <form className="mt-4 grid gap-3" onSubmit={invite}>
      <MobileFormShell>
        <MobileFormHeader
          rightAction={
            <button
              className={mobilePrimaryActionClassName}
              disabled={!canInvite}
              type="submit"
            >
              {isPending ? "Sending..." : "Invite"}
            </button>
          }
          subtitle="Share this trip with someone"
          title="Trip guests"
        />
        <MobileFormSection title="Invite">
          <MobileField label="Email">
            <input
              aria-label="Email"
              className={mobileInputClassName}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
          </MobileField>
          <MobileField label="Role">
            <select
              aria-label="Role"
              className={mobileSelectClassName}
              onChange={(event) => setRole(event.target.value)}
              value={role}
            >
              <option className="bg-[#1f1f21] text-white">Editor</option>
              <option className="bg-[#1f1f21] text-white">Commenter</option>
              <option className="bg-[#1f1f21] text-white">Viewer</option>
            </select>
          </MobileField>
        </MobileFormSection>
        {state.status !== "idle" && message ? (
          <div className="px-4 pb-4">
            <p className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${messageTone}`}>
              {message}
            </p>
          </div>
        ) : null}
      </MobileFormShell>
    </form>
  );
}
