import type { User } from "@supabase/supabase-js";

type SupabaseClient = {
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => PromiseLike<unknown>;
  };
};

export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const metadata = user.user_metadata || {};
  const username =
    readString(metadata.full_name) || readString(metadata.name) || user.email || "Traveler";
  const avatarUrl = readString(metadata.avatar_url) || readString(metadata.picture);

  await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        username,
        avatar_url: avatarUrl
      },
      { onConflict: "id" }
    );
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
