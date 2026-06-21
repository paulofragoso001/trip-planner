import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

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

const preferenceUpdateSchema = z
  .object({
    email_comments: z.boolean().optional(),
    email_mentions: z.boolean().optional(),
    inapp_comments: z.boolean().optional(),
    inapp_mentions: z.boolean().optional(),
    user_id: z.string().trim().min(1).max(160).optional()
  })
  .strict();

type PreferencesClient = {
  from: (table: "notification_preferences") => any;
};

export async function POST(req: Request) {
  const csrfError = validateSessionMutationRequest(req);
  if (csrfError) {
    return csrfError;
  }

  const body = await readJson(req);
  const parsed = preferenceUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodError(parsed.error) },
      { status: 400 }
    );
  }

  const auth = await authorizeDashboardApi<PreferencesClient>();

  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const parsedBody = parsed.data as PreferenceUpdate;

  if (parsedBody.user_id && parsedBody.user_id !== auth.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const updates = allowedFields.reduce<Partial<PreferenceUpdate>>((current, field) => {
    if (typeof parsedBody[field] === "boolean") {
      current[field] = parsedBody[field];
    }

    return current;
  }, {});

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No valid preferences to update." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("notification_preferences")
    .upsert({ user_id: auth.userId, ...updates }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, preferences: data });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function formatZodError(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Invalid preferences payload.";

  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
