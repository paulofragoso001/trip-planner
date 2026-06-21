"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  MobileField,
  MobileFormHeader,
  MobileFormSection,
  MobileFormShell,
  mobilePrimaryActionClassName,
  mobileTextareaClassName
} from "@/components/ui/mobile-form";
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
  const [confirmedDeletion, setConfirmedDeletion] = useState(false);
  const { isPending, run, state } = useWaylineAction<DeletionRequestResponse>();

  const currentRequest = useMemo(
    () => state.data?.request ?? existingRequest,
    [existingRequest, state.data]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await run({
      body: { confirmDeletion: true, reason },
      method: "POST",
      url: "/api/account/deletion-request"
    });
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <MobileFormShell>
          <MobileFormHeader
          rightAction={
            <button
              className={`${mobilePrimaryActionClassName} bg-red-600 hover:bg-red-500`}
              disabled={isPending || Boolean(currentRequest) || !confirmedDeletion}
              type="submit"
            >
              {isPending ? "Submitting..." : currentRequest ? "Requested" : "Request"}
            </button>
          }
          subtitle="This is reviewed before anything is removed"
          title="Delete Account"
        />
        <MobileFormSection title="Request">
          <MobileField label="Deletion reason">
            <textarea
              aria-label="Deletion reason"
              className={mobileTextareaClassName}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional context for the operator processing this request"
              value={reason}
            />
          </MobileField>
          <label className="flex items-start gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <input
              checked={confirmedDeletion}
              className="mt-1 h-4 w-4 accent-red-600"
              disabled={Boolean(currentRequest)}
              onChange={(event) => setConfirmedDeletion(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand this requests permanent deletion of my account data after operator review.
            </span>
          </label>
        </MobileFormSection>
      </MobileFormShell>

      {currentRequest ? (
        <p className="rounded-2xl bg-amber-400/12 px-4 py-3 text-sm font-semibold text-amber-100 ring-1 ring-amber-300/20 lg:bg-amber-50 lg:text-amber-800 lg:ring-transparent">
          Request status: {currentRequest.status}. Submitted{" "}
          {new Date(currentRequest.requested_at).toLocaleDateString()}.
        </p>
      ) : null}

      {state.message && !currentRequest ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            state.status === "success"
              ? "bg-emerald-400/12 text-emerald-100 ring-1 ring-emerald-300/20 lg:bg-emerald-50 lg:text-emerald-700 lg:ring-transparent"
              : "bg-red-400/12 text-red-100 ring-1 ring-red-300/20 lg:bg-red-50 lg:text-red-700 lg:ring-transparent"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
