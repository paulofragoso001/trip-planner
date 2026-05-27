import {
  apiCanonicalSuccess,
  ApiError,
  handleApiError,
  unauthorized
} from "@/lib/api/errors";
import { createClient } from "@/lib/supabase/server";

const routeName = "account/deletion-request";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized();
    }

    const body = await readJson(request);
    const reason =
      isRecord(body) && typeof body.reason === "string"
        ? body.reason.trim().slice(0, 1000) || null
        : null;

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
        reason,
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
