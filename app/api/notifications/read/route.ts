import { NextResponse } from "next/server";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";

type NotificationsClient = {
  from: (table: "notifications") => any;
};

export async function POST(req: Request) {
  const { userId } = (await req.json()) as { userId?: string };
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

function isMissingNotificationsTable(message: string) {
  return /notifications.*schema cache|relation .*notifications.* does not exist/i.test(message);
}
