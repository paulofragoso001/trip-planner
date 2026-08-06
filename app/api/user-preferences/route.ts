import { NextResponse } from "next/server";
import { defaultUserPreferences, userPreferencesPatchSchema, type UserPreferences, type UserPreferencesPatch, type UserPreferencesResponse } from "@/lib/user-preferences";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

type PreferencesClient = { from: (table: "user_preferences") => any };
const columns = "default_currency,distance_unit";
export async function GET() {
  const auth = await authorizeDashboardApi<PreferencesClient>();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data, error } = await auth.supabase.from("user_preferences").select(columns).eq("user_id", auth.userId).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load user preferences." }, { status: 502 });
  const response: UserPreferencesResponse = { preferences: data ? normalizePreferences(data) : defaultUserPreferences, source: data ? "persisted" : "default" };
  return NextResponse.json(response);
}
export async function PATCH(request: Request) {
  const csrfError = validateSessionMutationRequest(request); if (csrfError) return csrfError;
  const parsed = userPreferencesPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid preferences." }, { status: 400 });
  const auth = await authorizeDashboardApi<PreferencesClient>();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const result = await updateOrInsert(auth.supabase, auth.userId, parsed.data);
  if (!result) return NextResponse.json({ error: "Could not update user preferences." }, { status: 502 });
  const response: UserPreferencesResponse = { preferences: normalizePreferences(result), source: "persisted" };
  return NextResponse.json(response);
}
async function updateOrInsert(client: PreferencesClient, userId: string, patch: UserPreferencesPatch) {
  const updated = await client.from("user_preferences").update(patch).eq("user_id", userId).select(columns).maybeSingle();
  if (updated.error) return null; if (updated.data) return updated.data;
  const inserted = await client.from("user_preferences").insert({ user_id: userId, ...patch }).select(columns).single();
  if (!inserted.error) return inserted.data;
  const retried = await client.from("user_preferences").update(patch).eq("user_id", userId).select(columns).maybeSingle();
  return retried.error ? null : retried.data;
}
function normalizePreferences(value: Record<string, unknown>): UserPreferences {
  const parsed = userPreferencesPatchSchema.safeParse(value);
  return parsed.success ? { ...defaultUserPreferences, ...parsed.data } : defaultUserPreferences;
}
async function readJson(request: Request) { try { return await request.json(); } catch { return null; } }
