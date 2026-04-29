"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/upload-avatar";

type Profile = {
  username: string | null;
  avatar_url: string | null;
};

type ProfileAvatarProps = {
  userId: string;
  email: string;
  profile: Profile | null;
};

const defaultAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23e2e8f0'/%3E%3Ccircle cx='32' cy='25' r='11' fill='%2394a3b8'/%3E%3Cpath d='M14 55c3-12 12-18 18-18s15 6 18 18' fill='%2394a3b8'/%3E%3C/svg%3E";

export function ProfileAvatar({ userId, email, profile }: ProfileAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const username = profile?.username || email;

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");

    try {
      const url = await uploadAvatar(file, userId);
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload avatar.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
      <img
        alt={username}
        className="h-8 w-8 rounded-full object-cover"
        src={avatarUrl || defaultAvatar}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{username}</p>
        <label className="mt-0.5 block cursor-pointer text-xs font-semibold text-slate-500">
          {uploading ? "Uploading..." : "Change avatar"}
          <input
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                handleUpload(file);
              }
            }}
          />
        </label>
        {error ? <p className="mt-1 text-xs font-semibold text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
