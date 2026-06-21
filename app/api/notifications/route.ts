import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

type NotificationUpdate = {
  ids?: string[];
};

type NotificationsClient = {
  from: (table: "notifications") => any;
};

const notificationUpdateSchema = z
  .object({
    ids: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(160)
          .regex(/^[a-zA-Z0-9_-]+$/, "Use only letters, numbers, underscores, and dashes.")
      )
      .max(100)
      .optional()
  })
  .strict();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const auth = await authorizeDashboardApi<NotificationsClient>();

  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (userId && userId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data, error } = await auth.supabase
    .from("notifications")
    .select("*")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingNotificationsTable(error.message)) {
      return NextResponse.json([]);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function PATCH(request: Request) {
  const csrfError = validateSessionMutationRequest(request);
  if (csrfError) {
    return csrfError;
  }

  const validation = notificationUpdateSchema.safeParse(await readJson(request));

  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error) },
      { status: 400 }
    );
  }

  const { ids } = validation.data as NotificationUpdate;
  const auth = await authorizeDashboardApi<NotificationsClient>();

  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let query = auth.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.userId);

  if (ids?.length) {
    query = query.in("id", ids);
  }

  const { error } = await query;

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
