"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { TripButton, TripCard, cn, tripUi } from "@/components/trip-ui";

export type SegmentTemplate = "hotel" | "meeting";

export type SegmentQuickFormValues = {
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  notes: string;
  confirmationCode: string;
  bookingUrl: string;
  organizer: string;
  virtualUrl: string;
};

export type SegmentQuickFormProps = {
  template: SegmentTemplate;
  tripId: string;
  defaultDate?: string;
  defaultLocation?: string;
  onCancel: () => void;
  onSave: (values: {
    tripId: string;
    template: SegmentTemplate;
    title: string;
    location: string;
    startTime: string;
    endTime: string;
    notes: string;
    confirmationCode?: string;
    bookingUrl?: string;
    organizer?: string;
    virtualUrl?: string;
  }) => Promise<void> | void;
  loading?: boolean;
};

type FieldName = "title" | "startTime" | "endTime";
type FieldErrors = Partial<Record<FieldName, string>>;

const emptyValues: SegmentQuickFormValues = {
  title: "",
  location: "",
  startTime: "",
  endTime: "",
  notes: "",
  confirmationCode: "",
  bookingUrl: "",
  organizer: "",
  virtualUrl: ""
};

export function SegmentQuickForm({
  template,
  tripId,
  defaultDate,
  defaultLocation,
  onCancel,
  onSave,
  loading = false
}: SegmentQuickFormProps) {
  const formId = useId();
  const [values, setValues] = useState<SegmentQuickFormValues>({
    ...emptyValues,
    location: defaultLocation ?? ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [alertMessage, setAlertMessage] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const startTimeInputRef = useRef<HTMLInputElement | null>(null);
  const endTimeInputRef = useRef<HTMLInputElement | null>(null);

  const titleLabel = template === "hotel" ? "Hotel name" : "Meeting title";
  const primaryCta = template === "hotel" ? "Save hotel" : "Save meeting";
  const heading = template === "hotel" ? "Add hotel" : "Add meeting";

  const canSave = useMemo(
    () =>
      values.title.trim().length > 0 &&
      values.startTime.trim().length > 0 &&
      values.endTime.trim().length > 0,
    [values.title, values.startTime, values.endTime]
  );

  function validate(): FieldErrors {
    const nextErrors: FieldErrors = {};

    if (!values.title.trim()) {
      nextErrors.title = `${titleLabel} is required.`;
    }

    if (!values.startTime.trim()) {
      nextErrors.startTime = "Start time is required.";
    }

    if (!values.endTime.trim()) {
      nextErrors.endTime = "End time is required.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAttemptedSubmit(true);
    setAlertMessage("");

    const nextErrors = validate();
    setFieldErrors(nextErrors);

    if (!canSave || Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField(nextErrors);
      announceErrors(nextErrors);
      return;
    }

    setSubmitting(true);

    try {
      await onSave({
        tripId,
        template,
        title: values.title.trim(),
        location: values.location.trim(),
        startTime: values.startTime,
        endTime: values.endTime,
        notes: values.notes.trim(),
        confirmationCode: values.confirmationCode.trim() || undefined,
        bookingUrl: values.bookingUrl.trim() || undefined,
        organizer:
          template === "meeting" ? values.organizer.trim() || undefined : undefined,
        virtualUrl:
          template === "meeting" ? values.virtualUrl.trim() || undefined : undefined
      });
    } catch {
      setAlertMessage("Could not save this segment.");
    } finally {
      setSubmitting(false);
    }
  }

  function announceErrors(nextErrors: FieldErrors) {
    const messages = Object.values(nextErrors).filter(Boolean);
    const intro =
      messages.length === 1
        ? "There is 1 error in this segment."
        : `There are ${messages.length} errors in this segment.`;

    setAlertMessage("");
    window.requestAnimationFrame(() => {
      setAlertMessage(`${intro} ${messages.join(" ")}`);
    });
  }

  function focusFirstInvalidField(nextErrors: FieldErrors) {
    const firstInvalidField = (["title", "startTime", "endTime"] as const).find(
      (field) => Boolean(nextErrors[field])
    );

    const refs = {
      title: titleInputRef,
      startTime: startTimeInputRef,
      endTime: endTimeInputRef
    };

    if (firstInvalidField) {
      refs[firstInvalidField].current?.focus();
    }
  }

  function update(field: keyof SegmentQuickFormValues) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      setValues((current) => ({ ...current, [field]: nextValue }));

      if (field in fieldErrors) {
        setFieldErrors((current) => ({ ...current, [field]: undefined }));
      }
    };
  }

  function fieldA11y(field: FieldName) {
    const error = attemptedSubmit ? fieldErrors[field] : undefined;
    const errorId = `${formId}-${field}-error`;

    return {
      error,
      errorId,
      control: {
        "aria-invalid": error ? true : undefined,
        "aria-errormessage": error ? errorId : undefined,
        "aria-describedby": error ? errorId : undefined
      }
    };
  }

  const title = fieldA11y("title");
  const startTime = fieldA11y("startTime");
  const endTime = fieldA11y("endTime");

  return (
    <form
      className={cn(tripUi.card.surface, "grid gap-4 p-5")}
      data-testid={`segment-quick-form-${template}`}
      noValidate
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="text-lg font-black">{heading}</h3>
        {defaultDate ? (
          <p className={`text-sm ${tripUi.text.bodyMuted}`}>{defaultDate}</p>
        ) : null}
      </div>

      <div
        aria-atomic="true"
        aria-live="assertive"
        className="sr-only"
        data-testid="form-live-region"
      >
        {alertMessage}
      </div>

      <label className="grid gap-1 text-sm font-semibold">
        {titleLabel}
        <input
          {...title.control}
          className={inputClass(Boolean(title.error))}
          data-testid="segment-title-input"
          name="segmentTitle"
          onChange={update("title")}
          ref={titleInputRef}
          required
          value={values.title}
        />
      </label>
      {title.error ? (
        <p
          className="text-sm font-semibold text-red-700"
          data-testid="segment-title-error"
          id={title.errorId}
        >
          {title.error}
        </p>
      ) : null}

      <label className="grid gap-1 text-sm font-semibold">
        Location
        <input
          className={inputClass(false)}
          onChange={update("location")}
          value={values.location}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <label className="grid gap-1 text-sm font-semibold">
            Start time
            <input
              {...startTime.control}
              className={inputClass(Boolean(startTime.error))}
              data-testid="segment-start-time-input"
              name="startTime"
              onChange={update("startTime")}
              ref={startTimeInputRef}
              required
              type="datetime-local"
              value={values.startTime}
            />
          </label>
          {startTime.error ? (
            <p
              className="text-sm font-semibold text-red-700"
              id={startTime.errorId}
            >
              {startTime.error}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1">
          <label className="grid gap-1 text-sm font-semibold">
            End time
            <input
              {...endTime.control}
              className={inputClass(Boolean(endTime.error))}
              data-testid="segment-end-time-input"
              name="endTime"
              onChange={update("endTime")}
              ref={endTimeInputRef}
              required
              type="datetime-local"
              value={values.endTime}
            />
          </label>
          {endTime.error ? (
            <p className="text-sm font-semibold text-red-700" id={endTime.errorId}>
              {endTime.error}
            </p>
          ) : null}
        </div>
      </div>

      {template === "meeting" ? (
        <>
          <label className="grid gap-1 text-sm font-semibold">
            Organizer
            <input
              className={inputClass(false)}
              onChange={update("organizer")}
              value={values.organizer}
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Virtual meeting URL
            <input
              className={inputClass(false)}
              onChange={update("virtualUrl")}
              type="url"
              value={values.virtualUrl}
            />
          </label>
        </>
      ) : (
        <>
          <label className="grid gap-1 text-sm font-semibold">
            Confirmation code
            <input
              className={inputClass(false)}
              onChange={update("confirmationCode")}
              value={values.confirmationCode}
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Booking URL
            <input
              className={inputClass(false)}
              onChange={update("bookingUrl")}
              type="url"
              value={values.bookingUrl}
            />
          </label>
        </>
      )}

      <label className="grid gap-1 text-sm font-semibold">
        Notes
        <textarea
          className={cn(inputClass(false), "min-h-28")}
          onChange={update("notes")}
          value={values.notes}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <TripButton
          data-testid="add-plan-submit"
          disabled={loading || submitting}
          type="submit"
          variant="primary"
        >
          {submitting ? "Saving..." : primaryCta}
        </TripButton>
        <TripButton onClick={onCancel} type="button">
          Cancel
        </TripButton>
      </div>
    </form>
  );
}

function inputClass(invalid: boolean) {
  return cn(
    "rounded-2xl border px-4 py-3",
    invalid ? "border-red-300 bg-red-50" : "border-black/10"
  );
}
