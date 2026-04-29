import { createClient } from "@/lib/supabase/client";

export async function uploadImage(file: File) {
  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.-]+/g, "-");
  const fileName = `${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("trip-images").upload(fileName, file);

  if (error) {
    throw error;
  }

  const { data: publicUrl } = supabase.storage
    .from("trip-images")
    .getPublicUrl(fileName);

  return publicUrl.publicUrl;
}
