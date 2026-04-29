import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PreferenceUpdate = {
  user_id?: string;
  email_comments?: boolean;
  inapp_comments?: boolean;
  email_mentions?: boolean;
  inapp_mentions?: boolean;
};

const allowedFields = [
  "email_comments",
  "inapp_comments",
  "email_mentions",
  "inapp_mentions"
] as const;

export async function POST(req: Request) {
  const body = (await req.json()) as PreferenceUpdate;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (body.user_id && body.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const updates = allowedFields.reduce<Partial<PreferenceUpdate>>((current, field) => {
    if (typeof body[field] === "boolean") {
      current[field] = body[field];
    }

    return current;
  }, {});

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No valid preferences to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, preferences: data });
}
