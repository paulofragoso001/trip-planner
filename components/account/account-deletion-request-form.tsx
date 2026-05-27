"use client";

import { FormEvent, useMemo, useState } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

type ExistingRequest = {
  id: string;
  requested_at: string;
  status: string;
} | null;

type DeletionRequestResponse = {
  message: string;
  request: ExistingRequest;
};

type AccountDeletionRequestFormProps = {
  existingRequest: ExistingRequest;
};

export function AccountDeletionRequestForm({
  existingRequest
}: AccountDeletionRequestFormProps) {
  const [reason, setReason] = useState("");
  const { isPending, run, state } = useWaylineAction<DeletionRequestResponse>();

  const currentRequest = useMemo(
    () => state.data?.request ?? existingRequest,
    [existingRequest, state.data]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await run({
      body: { reason },
      method: "POST",
      url: "/api/account/deletion-request"
    });
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="grid gap-2 text-sm font-bold text-ink">
        Deletion reason
        <textarea
          className="min-h-28 rounded-xl border border-line px-4 py-3 text-sm font-medium text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/20"
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Optional context for the operator processing this request"
          value={reason}
        />
      </label>

      <button
        className="min-h-11 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
        disabled={isPending || Boolean(currentRequest)}
        type="submit"
      >
        {isPending ? "Submitting..." : currentRequest ? "Deletion requested" : "Request account deletion"}
      </button>

      {currentRequest ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Request status: {currentRequest.status}. Submitted{" "}
          {new Date(currentRequest.requested_at).toLocaleDateString()}.
        </p>
      ) : null}

      {state.message && !currentRequest ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            state.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
