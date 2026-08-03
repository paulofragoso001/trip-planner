const almidySupabaseUrl = "https://tgvlskojbwxpinfqzmne.supabase.co";

export function getSupabaseUrl() {
  const configured = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return configured ?? almidySupabaseUrl;
}

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value) return null;
  const candidate = value
    .trim()
    .replace(/^NEXT_PUBLIC_SUPABASE_URL=/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}
