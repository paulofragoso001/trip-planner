import { NextResponse } from "next/server";
import { sendCommentEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type NotificationPreferences = {
  email_comments: boolean | null;
  inapp_comments: boolean | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_segment_comments")
    .select("*, profiles (avatar_url, username)")
    .eq("trip_segment_id", itemId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const { trip_segment_id, author, content } = await request.json();
  const segmentId = trip_segment_id;

  if (!segmentId || !content?.trim()) {
    return NextResponse.json(
      { error: "trip_segment_id and content are required." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const metadata = user?.user_metadata || {};
  const authorName =
    readString(metadata.full_name) ||
    readString(metadata.name) ||
    user?.email ||
    author?.trim() ||
    "Guest";
  const authorAvatarUrl =
    readString(metadata.avatar_url) || readString(metadata.picture) || null;
  const { data, error } = await supabase
    .from("trip_segment_comments")
    .insert({
      trip_segment_id: segmentId,
      user_id: user?.id || null,
      author_id: user?.id || null,
      author: authorName,
      author_avatar_url: authorAvatarUrl,
      content: content.trim()
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (user) {
    const { data: item } = await supabase
      .from("trip_segments")
      .select("title,trip_id")
      .eq("id", segmentId)
      .single();

    if (item?.trip_id) {
      const { data: trip } = await supabase
        .from("trips")
        .select("name,user_id,slug")
        .eq("id", item.trip_id)
        .single();
      const itemTitle = item.title || "your trip";
      const commenter = displayFirstName(authorName);
      const prefs = trip?.user_id
        ? await getNotificationPreferences(trip.user_id)
        : defaultNotificationPreferences();

      if (trip?.user_id && trip.user_id !== user.id && prefs.inapp_comments) {
        await supabase.from("notifications").insert({
          user_id: trip.user_id,
          type: "comment",
          title: `${commenter} commented on ${itemTitle}`,
          body: "Open the trip to review the new comment.",
          trip_id: item.trip_id,
          trip_segment_id: segmentId,
          metadata: { trip_segment_id: segmentId }
        });
      }

      const ownerEmail =
        trip?.user_id && trip.user_id !== user.id
          ? await getOwnerEmail(trip.user_id)
          : null;

      if (ownerEmail && ownerEmail !== user.email && prefs.email_comments) {
        await sendCommentEmail({
          to: ownerEmail,
          commenter,
          tripTitle: trip?.name || "Trip itinerary",
          itemTitle,
          tripUrl: trip?.slug
            ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/trip/${trip.slug}`
            : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }).catch((error) => {
          console.error("Comment email failed:", error);
        });
      }
    }
  }

  return NextResponse.json(data, { status: 201 });
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function displayFirstName(value: string) {
  const name = value.includes("@") ? value.split("@")[0] : value;
  return name.split(/[.\s_-]/).filter(Boolean)[0] || "Someone";
}

async function getOwnerEmail(userId: string) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error) {
    console.error("Owner email lookup failed:", error);
    return null;
  }

  return data.user?.email || null;
}

async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const fallback = defaultNotificationPreferences();
  const admin = createAdminClient();

  if (!admin) {
    return fallback;
  }

  const { data, error } = await admin
    .from("notification_preferences")
    .select("email_comments,inapp_comments")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Notification preferences lookup failed:", error);
    return fallback;
  }

  return {
    email_comments: data?.email_comments ?? true,
    inapp_comments: data?.inapp_comments ?? true
  };
}

function defaultNotificationPreferences(): NotificationPreferences {
  return {
    email_comments: true,
    inapp_comments: true
  };
}
