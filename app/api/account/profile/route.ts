import { NextResponse } from "next/server";
import { profileMutationSchema, type AccountProfileResponse } from "@/lib/account/contracts";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

type ProfileClient = {
  from: (table: "profiles") => any;
  auth: { updateUser: (attributes: { data: { full_name: string } }) => Promise<{ error: { message: string } | null }> };
};

export async function GET() {
  const auth = await authorizeDashboardApi<ProfileClient>();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data, error } = await auth.supabase.from("profiles").select("username").eq("id", auth.userId).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load profile." }, { status: 502 });
  return NextResponse.json({ profile: { displayName: data?.username || auth.userEmail || "Traveler", userId: auth.userId }, synchronization: "synchronized" } satisfies AccountProfileResponse);
}

export async function POST(request: Request) {
  const csrfError = validateSessionMutationRequest(request);
  if (csrfError) return csrfError;
  const parsed = profileMutationSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid display name." }, { status: 400 });

  const auth = await authorizeDashboardApi<ProfileClient>();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const displayName = parsed.data.displayName;
  const { data, error } = await auth.supabase.from("profiles")
    .upsert({ id: auth.userId, username: displayName }, { onConflict: "id" })
    .select("username").single();
  if (error || data?.username !== displayName) {
    return NextResponse.json({ error: "Could not update profile." }, { status: 502 });
  }

  const { error: metadataError } = await auth.supabase.auth.updateUser({ data: { full_name: displayName } });
  const response: AccountProfileResponse = {
    profile: { displayName, userId: auth.userId },
    synchronization: metadataError ? "metadata_reconciliation_required" : "synchronized"
  };
  return NextResponse.json(response, { status: metadataError ? 202 : 200 });
}

async function readJson(request: Request) { try { return await request.json(); } catch { return null; } }
