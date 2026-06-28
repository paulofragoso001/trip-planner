import {
  apiCanonicalSuccess,
  ApiError,
  handleApiError,
  unauthorized
} from "@/lib/api/errors";
import { validationFailure } from "@/lib/api/errors";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import { createClient } from "@/lib/supabase/server";

const routeName = "account/deletion-request";

export async function POST(request: Request) {
  try {
    const csrfError = validateSessionMutationRequest(request);
    if (csrfError) {
      return csrfError;
    }

    const validation = validateDeletionRequestBody(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid account deletion request payload.", validation.details);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized();
    }

    const { data: existingRequest, error: existingError } = await supabase
      .from("account_deletion_requests")
      .select("id,status,requested_at")
      .eq("user_id", user.id)
      .in("status", ["requested", "in_review"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new ApiError(
        "bad_gateway",
        "Could not check account deletion request status.",
        502,
        { databaseError: existingError.message }
      );
    }

    if (existingRequest) {
      return apiCanonicalSuccess({
        message: "Account deletion request already exists.",
        request: existingRequest
      });
    }

    const { data: createdRequest, error: insertError } = await supabase
      .from("account_deletion_requests")
      .insert({
        email: user.email ?? null,
        reason: validation.value.reason,
        user_id: user.id
      })
      .select("id,status,requested_at")
      .single();

    if (insertError) {
      throw new ApiError(
        "bad_gateway",
        "Could not submit account deletion request.",
        502,
        { databaseError: insertError.message }
      );
    }

    return apiCanonicalSuccess(
      {
        message: "Account deletion request submitted.",
        request: createdRequest
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

function validateDeletionRequestBody(value: unknown) {
  if (!isRecord(value)) {
    return {
      details: { body: "Expected a JSON object." },
      ok: false as const
    };
  }

  const details: Record<string, string> = {};
  const unknown = Object.keys(value).filter(
    (key) => key !== "confirmDeletion" && key !== "confirmationPhrase" && key !== "reason"
  );

  if (unknown.length) {
    details.body = `Unknown field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`;
  }

  if (value.confirmDeletion !== true) {
    details.confirmDeletion = "Account deletion requests require confirmation.";
  }

  if (value.confirmationPhrase !== "DELETE MY ACCOUNT") {
    details.confirmationPhrase = "Type DELETE MY ACCOUNT to confirm this account deletion request.";
  }

  let reason: string | null = null;

  if (value.reason != null) {
    if (typeof value.reason !== "string") {
      details.reason = "Expected a string.";
    } else {
      const trimmed = value.reason.trim();
      if (trimmed.length > 1000) {
        details.reason = "Expected 1000 characters or fewer.";
      } else {
        reason = trimmed || null;
      }
    }
  }

  if (Object.keys(details).length) {
    return { details, ok: false as const };
  }

  return { ok: true as const, value: { reason } };
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
