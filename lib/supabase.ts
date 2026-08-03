import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/config";

export const supabase = createClient(
  getSupabaseUrl(),
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
