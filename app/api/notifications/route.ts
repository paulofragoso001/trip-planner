import { NextResponse } from "next/server";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";

type NotificationUpdate = {
  ids?: string[];
};

type NotificationsClient = {
  from: (table: "notifications") => any;
};

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
  const { ids } = (await request.json()) as NotificationUpdate;
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

function isMissingNotificationsTable(message: string) {
  return /notifications.*schema cache|relation .*notifications.* does not exist/i.test(message);
}
