export async function uploadAvatar(file: File) {
  const form = new FormData(); form.set("avatar", file);
  const response = await fetch("/api/account/avatar", { method: "POST", body: form });
  const result = await response.json() as { avatarUrl?: string; error?: string };
  if (!response.ok || !result.avatarUrl) throw new Error(result.error || "Could not upload avatar.");
  return result.avatarUrl;
}
