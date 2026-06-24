import { apiCanonicalSuccess, apiFailure, validationFailure } from "@/lib/api/errors";
import { sendTripInviteEmail } from "@/lib/email";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { isDemoTripId, isUuid } from "@/lib/server/trip-id";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await authorizeDashboardApi();

  if (!auth) {
    return apiFailure("unauthorized", "Unauthorized", 401);
  }

  const payload = await request.json().catch(() => ({}));
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const role = normalizeRole(payload.role);

  if (email && !email.includes("@")) {
    return validationFailure("Enter a valid collaborator email.");
  }

  if (isDemoTripId(id) || !isUuid(id)) {
    return apiCanonicalSuccess({
      message: email ? `Invite staged for ${email}.` : "Trip sharing enabled.",
      shared: true,
      tripId: id
    });
  }

  const { data: trip, error: tripError } = await auth.supabase
    .from("trips")
    .update({ is_public: true })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id,user_id,name,title")
    .single();

  if (tripError || !trip) {
    return apiFailure("not_found", "Trip not found.", 404, {
      supabaseMessage: tripError?.message
    });
  }

  let emailSent = false;
  let emailWarning: string | null = null;

  if (email) {
    const { error: collaboratorError } = await upsertCollaborator({
      email,
      role,
      supabase: auth.supabase,
      tripId: id,
      userId: auth.userId
    });

    if (collaboratorError) {
      return apiFailure("internal_error", "Could not save collaborator.", 500, {
        supabaseMessage: collaboratorError.message
      });
    }

    const { error: inviteError } = await upsertInvite({
      email,
      role,
      supabase: auth.supabase,
      tripId: id,
      userId: auth.userId
    });

    if (inviteError) {
      return apiFailure("internal_error", "Could not save invite.", 500, {
        supabaseMessage: inviteError.message
      });
    }

    const inviteUrl = buildTripUrl(id);

    try {
      const result = await sendTripInviteEmail({
        inviterName: "Almidy",
        role,
        to: email,
        tripTitle: readTripTitle(trip),
        tripUrl: inviteUrl
      });
      emailSent = result?.sent === true;
      emailWarning = result?.sent === false ? result.reason : null;
    } catch (error) {
      emailWarning = "Invite was saved, but email delivery failed.";
      console.error("Trip invite email failed:", error);
    }
  }

  return apiCanonicalSuccess({
    emailSent,
    emailWarning,
    message: email ? `Invite staged for ${email}.` : "Trip sharing enabled.",
    shared: true,
    tripId: id
  });
}

function normalizeRole(value: unknown) {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "viewer";

  if (role === "editor" || role === "commenter" || role === "viewer") {
    return role;
  }

  return "viewer";
}

async function upsertCollaborator({
  email,
  role,
  supabase,
  tripId,
  userId
}: {
  email: string;
  role: string;
  supabase: any;
  tripId: string;
  userId: string;
}) {
  const { data: existing, error: selectError } = await supabase
    .from("trip_collaborators")
    .select("id")
    .eq("trip_id", tripId)
    .eq("email", email)
    .maybeSingle();

  if (selectError) {
    return { error: selectError };
  }

  if (existing?.id) {
    return supabase
      .from("trip_collaborators")
      .update({
        invited_by: userId,
        role,
        status: "pending"
      })
      .eq("id", existing.id);
  }

  return supabase.from("trip_collaborators").insert({
    email,
    invited_by: userId,
    role,
    status: "pending",
    trip_id: tripId
  });
}

async function upsertInvite({
  email,
  role,
  supabase,
  tripId,
  userId
}: {
  email: string;
  role: string;
  supabase: any;
  tripId: string;
  userId: string;
}) {
  const { data: existing, error: selectError } = await supabase
    .from("trip_collaboration_invites")
    .select("id")
    .eq("trip_id", tripId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (selectError) {
    return { error: selectError };
  }

  const inviteRole = role === "owner" ? "viewer" : role;

  if (existing?.id) {
    return supabase
      .from("trip_collaboration_invites")
      .update({
        invited_by: userId,
        role: inviteRole
      })
      .eq("id", existing.id);
  }

  return supabase.from("trip_collaboration_invites").insert({
    email,
    invited_by: userId,
    role: inviteRole,
    status: "pending",
    trip_id: tripId
  });
}

function buildTripUrl(tripId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/dashboard/trips/${tripId}/share`;
}

function readTripTitle(trip: Record<string, unknown>) {
  return String(trip.name || trip.title || "Almidy trip");
}
