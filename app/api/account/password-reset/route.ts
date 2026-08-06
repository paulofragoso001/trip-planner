import { NextResponse } from "next/server";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

type AuthClient = { auth: { resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<{ error: { message?: string; status?: number } | null }> } };

export async function POST(request: Request) {
  const csrfError = validateSessionMutationRequest(request);
  if (csrfError) return csrfError;
  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) return NextResponse.json({ error: "This action does not accept an email address or other fields." }, { status: 400 });
  const auth = await authorizeDashboardApi<AuthClient>();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!auth.userEmail) return NextResponse.json({ error: "No verified email is available for this account." }, { status: 409 });
  const origin = productionOrigin();
  const { error } = await auth.supabase.auth.resetPasswordForEmail(auth.userEmail, { redirectTo: `${origin}/auth/reset-password` });
  if (error) {
    const rateLimited = error.status === 429 || /rate|limit/i.test(error.message || "");
    return NextResponse.json({ error: rateLimited ? "Please wait before requesting another reset email." : "A reset email could not be requested right now." }, { status: rateLimited ? 429 : 502 });
  }
  return NextResponse.json({ message: "If email delivery succeeds, Almidy will send password-reset instructions to your verified account email. The link opens the approved web reset flow." });
}

function productionOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL || "https://almidy.app";
  const url = new URL(value.startsWith("http") ? value : `https://${value}`);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Password reset origin must use HTTPS in production.");
  return url.origin;
}
async function readJson(request: Request) { try { return await request.json(); } catch { return null; } }
