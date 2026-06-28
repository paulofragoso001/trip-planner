"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  MobileField,
  MobileFormHeader,
  MobileFormSection,
  MobileFormShell,
  mobilePrimaryActionClassName,
  mobileSecondaryActionClassName,
  mobileTextareaClassName
} from "@/components/ui/mobile-form";
import { useAlmidyAction } from "@/hooks/use-wayline-action";

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

const deletionConfirmationPhrase = "DELETE MY ACCOUNT";

export function AccountDeletionRequestForm({
  existingRequest
}: AccountDeletionRequestFormProps) {
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [reason, setReason] = useState("");
  const [confirmedDeletion, setConfirmedDeletion] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const { isPending, run, state } = useAlmidyAction<DeletionRequestResponse>();

  const currentRequest = useMemo(
    () => state.data?.request ?? existingRequest,
    [existingRequest, state.data]
  );
  const canOpenReview = !isPending && !currentRequest && confirmedDeletion;
  const canSubmitRequest =
    canOpenReview && confirmationPhrase.trim() === deletionConfirmationPhrase;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await run({
      body: {
        confirmDeletion: true,
        confirmationPhrase: confirmationPhrase.trim(),
        reason
      },
      method: "POST",
      url: "/api/account/deletion-request"
    });
  }

  return (
    <form className="grid gap-4" data-testid="account-deletion-request-form" onSubmit={onSubmit}>
      <MobileFormShell>
        <MobileFormHeader
          rightAction={
            <button
              className={`${mobilePrimaryActionClassName} bg-red-600 hover:bg-red-500`}
              disabled={!canOpenReview}
              onClick={() => setReviewOpen(true)}
              type="button"
            >
              {currentRequest ? "Requested" : "Review"}
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
              onChange={(event) => {
                setConfirmedDeletion(event.target.checked);
                if (!event.target.checked) {
                  setReviewOpen(false);
                  setConfirmationPhrase("");
                }
              }}
              type="checkbox"
            />
            <span>
              I understand this starts a reviewed request to permanently delete my Almidy account data.
            </span>
          </label>
        </MobileFormSection>
      </MobileFormShell>

      {reviewOpen && !currentRequest ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-end bg-black/54 p-3 backdrop-blur-sm lg:place-items-center"
          data-testid="account-deletion-review-overlay"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-[1.75rem] border border-red-300/20 bg-[#1f1f21] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] lg:bg-white lg:text-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300 lg:text-red-600">
              Final review
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight">
              Confirm account deletion request
            </h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/64 lg:text-slate-600">
              Almidy will create an auditable request. An operator reviews account-owned data,
              connected providers, and cleanup before deletion is processed.
            </p>
            <label className="mt-5 grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/42 lg:text-slate-500">
                Type {deletionConfirmationPhrase}
              </span>
              <input
                autoComplete="off"
                className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-base font-black text-white outline-none placeholder:text-white/32 focus:border-red-300/60 focus:ring-4 focus:ring-red-400/15 lg:border-slate-200 lg:bg-slate-50 lg:text-slate-950 lg:placeholder:text-slate-400"
                data-testid="account-deletion-confirmation-phrase"
                onChange={(event) => setConfirmationPhrase(event.target.value)}
                placeholder={deletionConfirmationPhrase}
                value={confirmationPhrase}
              />
            </label>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className={mobileSecondaryActionClassName}
                disabled={isPending}
                onClick={() => {
                  setReviewOpen(false);
                  setConfirmationPhrase("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                aria-busy={isPending}
                className={`${mobilePrimaryActionClassName} bg-red-600 hover:bg-red-500`}
                data-testid="account-deletion-final-submit"
                disabled={!canSubmitRequest || isPending}
                type="submit"
              >
                {isPending ? "Submitting..." : "Submit deletion request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
