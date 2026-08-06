import { z } from "zod";

export const notificationPreferenceFields = [
  "email_comments",
  "inapp_comments",
  "email_mentions",
  "inapp_mentions"
] as const;

export type NotificationPreferenceField = (typeof notificationPreferenceFields)[number];
export type NotificationPreferences = Record<NotificationPreferenceField, boolean>;

export const defaultNotificationPreferences: NotificationPreferences = {
  email_comments: true,
  email_mentions: true,
  inapp_comments: true,
  inapp_mentions: true
};

export const notificationPreferencesMutationSchema = z
  .object({
    email_comments: z.boolean().optional(),
    email_mentions: z.boolean().optional(),
    inapp_comments: z.boolean().optional(),
    inapp_mentions: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one preference is required.");

export type NotificationPreferencesResponse = {
  preferences: NotificationPreferences;
  source: "default" | "persisted";
};

export type NotificationPreferencesMutation = z.infer<
  typeof notificationPreferencesMutationSchema
>;

export const displayNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Display name must be at least 2 characters.")
      .max(80, "Display name must be 80 characters or fewer.")
      .regex(/^[\p{L}\p{M}][\p{L}\p{M}\p{N} .,'’\-]*$/u, "Display name contains unsupported characters.")
  );

export const profileMutationSchema = z.object({ displayName: displayNameSchema }).strict();

export type AccountProfileResponse = {
  profile: { displayName: string; userId: string };
  synchronization: "synchronized" | "metadata_reconciliation_required";
};

export type DeletionRequestStatus =
  | "requested"
  | "pending"
  | "in_review"
  | "completed"
  | "rejected"
  | "cancelled";

export type AccountDeletionRequestStatusResponse = {
  request: {
    id: string;
    requested_at: string;
    status: DeletionRequestStatus;
  } | null;
};
