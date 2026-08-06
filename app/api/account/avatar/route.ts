import { NextResponse } from "next/server";
import { avatarBucket, createAvatarPath, ownedAvatarPath, validateAvatarFile } from "@/lib/avatar";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

type AvatarClient = { from: (table: "profiles") => any; storage: { from: (bucket: string) => any } };

export async function POST(request: Request) {
  const csrfError = validateSessionMutationRequest(request); if (csrfError) return csrfError;
  const auth = await authorizeDashboardApi<AvatarClient>();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Expected a multipart image upload." }, { status: 400 }); }
  if ([...form.keys()].some((key) => key !== "avatar")) return NextResponse.json({ error: "Unexpected upload field." }, { status: 400 });
  const file = form.get("avatar");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an avatar image." }, { status: 400 });
  let mime: Awaited<ReturnType<typeof validateAvatarFile>>;
  try { mime = await validateAvatarFile(file); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid avatar." }, { status: 400 }); }

  const storage = auth.supabase.storage.from(avatarBucket);
  const path = createAvatarPath(auth.userId, mime);
  const { data: profile } = await auth.supabase.from("profiles").select("avatar_url").eq("id", auth.userId).maybeSingle();
  const oldPath = ownedAvatarPath(profile?.avatar_url ?? null, auth.userId);
  const { error: uploadError } = await storage.upload(path, file, { cacheControl: "3600", contentType: mime, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Could not upload avatar." }, { status: 502 });
  const fileName = path.split("/")[1];
  const { data: confirmation, error: confirmationError } = await storage.list(auth.userId, { search: fileName });
  if (confirmationError || !confirmation?.some((item: { name: string }) => item.name === fileName)) {
    await storage.remove([path]);
    return NextResponse.json({ error: "Could not confirm avatar upload." }, { status: 502 });
  }
  const { data: publicData } = storage.getPublicUrl(path);
  const { error: profileError } = await auth.supabase.from("profiles").upsert({ id: auth.userId, avatar_url: publicData.publicUrl }, { onConflict: "id" });
  if (profileError) {
    await storage.remove([path]);
    return NextResponse.json({ error: "Could not update profile; the previous avatar was preserved." }, { status: 502 });
  }
  if (oldPath && oldPath !== path) await storage.remove([oldPath]);
  return NextResponse.json({ avatarUrl: publicData.publicUrl });
}
