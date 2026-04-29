import { createClient } from "@/lib/supabase/client";

export async function uploadAvatar(file: File, userId: string) {
  const supabase = createClient();
  const extension = file.name.split(".").pop();
  const fileName = `${userId}-${Date.now()}${extension ? `.${extension}` : ""}`;
  const { error } = await supabase.storage.from("avatars").upload(fileName, file);

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);

  return data.publicUrl;
}
