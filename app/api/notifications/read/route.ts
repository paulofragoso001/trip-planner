import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

type NotificationsClient = {
  from: (table: "notifications") => any;
};

const notificationReadSchema = z
  .object({
    userId: z.string().trim().min(1).max(160).optional()
  })
  .strict();

export async function POST(req: Request) {
  const csrfError = validateSessionMutationRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const validation = notificationReadSchema.safeParse(await readJson(req));

  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error) },
      { status: 400 }
    );
  }

  const { userId } = validation.data as { userId?: string };
  const auth = await authorizeDashboardApi<NotificationsClient>();

  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (userId && userId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.userId);

  if (error) {
    if (isMissingNotificationsTable(error.message)) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isMissingNotificationsTable(message: string) {
  return /notifications.*schema cache|relation .*notifications.* does not exist/i.test(message);
}

function formatZodError(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Invalid notification payload.";

  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
