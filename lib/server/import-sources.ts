import "server-only";

import { ApiError } from "@/lib/api/errors";
import {
  importSourceTypes,
  type ImportSourcePatchInput,
  type ImportSourceType
} from "@/lib/validators/import-sources";

type ImportSourceRecord = {
  connected: boolean;
  created_at?: string;
  id?: string;
  last_error: string | null;
  last_synced_at: string | null;
  metadata?: Record<string, unknown>;
  source_label: string | null;
  source_type: string;
  updated_at?: string;
  user_id?: string;
};

export type ImportSourcesClient = {
  from: (table: "import_sources") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options: { ascending: boolean }
        ) => PromiseLike<{ data: ImportSourceRecord[] | null; error: { message: string } | null }>;
      };
    };
    upsert: (
      payload: Record<string, unknown>,
      options: { onConflict: string }
    ) => {
      select: (columns: string) => {
        single: () => PromiseLike<{
          data: ImportSourceRecord | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

const sourceSelect =
  "id,user_id,source_type,connected,source_label,last_synced_at,last_error,metadata,created_at,updated_at";
const missingImportSourcesTableMessage =
  "Could not find the table 'public.import_sources'";

export async function listImportSources(
  supabase: ImportSourcesClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("import_sources")
    .select(sourceSelect)
    .eq("user_id", userId)
    .order("source_type", { ascending: true });

  if (error) {
    if (error.message.includes(missingImportSourcesTableMessage)) {
      return defaultImportSources();
    }

    throw new ApiError("internal_error", "Could not load import sources.", 500, {
      supabaseMessage: error.message
    });
  }

  return mergeDefaults(data || []);
}

export async function upsertImportSource(
  supabase: ImportSourcesClient,
  userId: string,
  input: ImportSourcePatchInput
) {
  const { data, error } = await supabase
    .from("import_sources")
    .upsert(
      {
        connected: input.connected,
        last_error: input.lastError,
        last_synced_at: input.connected ? new Date().toISOString() : null,
        source_label: input.sourceLabel || defaultSourceLabel(input.sourceType),
        source_type: input.sourceType,
        user_id: userId
      },
      { onConflict: "user_id,source_type" }
    )
    .select(sourceSelect)
    .single();

  if (error) {
    if (error.message.includes(missingImportSourcesTableMessage)) {
      throw new ApiError(
        "not_implemented",
        "Run migration 012_create_import_sources.sql before connecting import sources.",
        501
      );
    }

    throw new ApiError("internal_error", "Could not update import source.", 500, {
      supabaseMessage: error.message
    });
  }

  return data;
}

function defaultImportSources(): ImportSourceRecord[] {
  return importSourceTypes.map((sourceType) => ({
    connected: false,
    last_error: null,
    last_synced_at: null,
    source_label: defaultSourceLabel(sourceType),
    source_type: sourceType
  }));
}

function mergeDefaults(records: ImportSourceRecord[]) {
  const byType = new Map(
    records.map((record) => [
      record.source_type === "email" ? "email_forwarding" : record.source_type,
      record
    ])
  );

  return defaultImportSources().map((fallback) => {
    const record = byType.get(fallback.source_type);

    return record
      ? {
          ...fallback,
          ...record,
          source_type: fallback.source_type
        }
      : fallback;
  });
}

function defaultSourceLabel(sourceType: ImportSourceType) {
  if (sourceType === "calendar") return "Calendar feed";
  if (sourceType === "gmail") return "Gmail inbox sync";
  if (sourceType === "outlook") return "Outlook inbox sync";
  return "Forwarded email";
}
