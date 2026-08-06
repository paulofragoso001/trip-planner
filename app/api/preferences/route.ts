import { NextResponse } from "next/server";
import {
  defaultNotificationPreferences,
  notificationPreferenceFields,
  notificationPreferencesMutationSchema,
  type NotificationPreferences,
  type NotificationPreferencesResponse
} from "@/lib/account/contracts";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

type PreferencesClient = { from: (table: "notification_preferences") => any };

export async function GET() {
  const auth = await authorizeDashboardApi<PreferencesClient>();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("notification_preferences")
    .select(notificationPreferenceFields.join(","))
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load notification preferences." }, { status: 502 });
  }

  const response: NotificationPreferencesResponse = {
    preferences: data ? toPreferences(data) : defaultNotificationPreferences,
    source: data ? "persisted" : "default"
  };
  return NextResponse.json(response);
}

export async function POST(req: Request) {
  const csrfError = validateSessionMutationRequest(req);
  if (csrfError) return csrfError;

  const parsed = notificationPreferencesMutationSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const auth = await authorizeDashboardApi<PreferencesClient>();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("notification_preferences")
    .upsert({ user_id: auth.userId, ...parsed.data }, { onConflict: "user_id" })
    .select(notificationPreferenceFields.join(","))
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not update notification preferences." }, { status: 502 });
  }

  const response: NotificationPreferencesResponse = {
    preferences: toPreferences(data),
    source: "persisted"
  };
  return NextResponse.json(response);
}

function toPreferences(value: Record<string, unknown>): NotificationPreferences {
  return Object.fromEntries(
    notificationPreferenceFields.map((field) => [
      field,
      typeof value[field] === "boolean" ? value[field] : defaultNotificationPreferences[field]
    ])
  ) as NotificationPreferences;
}

async function readJson(request: Request) {
  try { return await request.json(); } catch { return null; }
}

function formatZodError(error: import("zod").ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Invalid preferences payload.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
