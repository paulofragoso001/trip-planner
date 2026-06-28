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
  const [reviewOpen, setReviewOpen] = useState(false);
  const { isPending, run, state } = useAlmidyAction<DeletionRequestResponse>();

  const currentRequest = useMemo(
    () => state.data?.request ?? existingRequest,
    [existingRequest, state.data]
  );
  const canOpenReview = !isPending && !currentRequest;
  const canSubmitRequest =
    canOpenReview && reviewOpen && confirmationPhrase === deletionConfirmationPhrase;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitRequest) {
      return;
    }

    await run({
      body: {
        confirmDeletion: true,
        confirmationPhrase,
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
          <div className="border-t border-red-300/20 pt-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300 lg:text-red-600">
              Danger Zone
            </p>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/58 lg:text-slate-600">
              Permanently deleting your account removes your travel wallet, saved trips,
              documents, and historical logs after operator review. This action cannot be undone.
            </p>

            {!reviewOpen ? (
              <button
                className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-45 lg:border-red-200 lg:bg-red-50 lg:text-red-700 lg:hover:bg-red-100"
                data-testid="account-deletion-open-review"
                disabled={!canOpenReview}
                onClick={() => setReviewOpen(true)}
                type="button"
              >
                {currentRequest ? "Deletion request submitted" : "Delete Account..."}
              </button>
            ) : (
              <div
                className="mt-4 rounded-[1.5rem] border border-red-300/20 bg-[#1f1f21] p-4 text-white shadow-[0_18px_64px_rgba(0,0,0,0.34)] lg:bg-white lg:text-slate-950"
                data-testid="account-deletion-review-panel"
              >
                <h3 className="text-lg font-black tracking-tight">
                  Are you absolutely sure?
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/58 lg:text-slate-600">
                  To proceed, type{" "}
                  <span className="select-none font-mono font-black text-red-300 lg:text-red-600">
                    &quot;{deletionConfirmationPhrase}&quot;
                  </span>{" "}
                  below. Almidy will create an auditable deletion request before any account data
                  is removed.
                </p>
                <label className="mt-4 grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-white/42 lg:text-slate-500">
                    Confirmation phrase
                  </span>
                  <input
                    autoComplete="off"
                    className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-base font-black tracking-wide text-white outline-none placeholder:text-white/32 focus:border-red-300/60 focus:ring-4 focus:ring-red-400/15 disabled:opacity-50 lg:border-slate-200 lg:bg-slate-50 lg:text-slate-950 lg:placeholder:text-slate-400"
                    data-testid="account-deletion-confirmation-phrase"
                    disabled={isPending}
                    onChange={(event) => setConfirmationPhrase(event.target.value)}
                    placeholder="Type required text match"
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
                    {isPending ? "Submitting..." : "Confirm Destruction"}
                  </button>
                </div>
              </div>
            )}
          </div>
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
