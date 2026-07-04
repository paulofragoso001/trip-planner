import type { SupabaseClient } from "@supabase/supabase-js";

export type ExpenseCurrency = "USD" | "EUR" | "GBP" | "BRL" | "JPY" | "CAD";
export type ExpenseCategory =
  | "transport"
  | "lodging"
  | "dining"
  | "activity"
  | "shopping"
  | "other";

export interface SegmentExpense {
  amount?: string;
  amount_cents: number;
  category: ExpenseCategory;
  created_at?: string;
  currency: ExpenseCurrency;
  id: string;
  segment_id: string;
  title: string;
  updated_at?: string;
}

export type SegmentExpenseInsert = {
  amount_cents: number;
  category: ExpenseCategory;
  currency: ExpenseCurrency;
  segment_id: string;
  title: string;
};

const expenseColumns = "id,segment_id,title,amount_cents,currency,category,created_at,updated_at";

export async function getSegmentExpenses(
  segmentId: string,
  supabaseClient?: SupabaseClient
) {
  const safeSegmentId = segmentId.trim();
  if (!safeSegmentId) {
    throw new Error("segmentId is required to fetch segment expenses.");
  }

  const supabase = supabaseClient || (await getDefaultSupabaseClient());
  const { data, error } = await supabase
    .from("trip_segment_expenses")
    .select(expenseColumns)
    .eq("segment_id", safeSegmentId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase fetch failure on segment expenses:", error.message);
    throw new Error(error.message);
  }

  const expenses = ((data || []) as SegmentExpense[]).map(formatExpenseRow);
  const totalCents = expenses.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);

  return {
    expenses,
    totalCents,
    totalFormatted: (totalCents / 100).toFixed(2)
  };
}

export async function createSegmentExpense(
  payload: SegmentExpenseInsert,
  supabaseClient?: SupabaseClient
) {
  validateSegmentExpensePayload(payload);

  const supabase = supabaseClient || (await getDefaultSupabaseClient());
  const { data, error } = await supabase
    .from("trip_segment_expenses")
    .insert([payload])
    .select(expenseColumns)
    .single();

  if (error) {
    console.error("Supabase write failure on segment expense insert:", error.message);
    throw new Error(error.message);
  }

  return formatExpenseRow(data as SegmentExpense);
}

function validateSegmentExpensePayload(payload: SegmentExpenseInsert) {
  if (!payload.segment_id?.trim()) {
    throw new Error("segment_id is required to create a segment expense.");
  }
  if (!payload.title?.trim()) {
    throw new Error("title is required to create a segment expense.");
  }
  if (!Number.isInteger(payload.amount_cents) || payload.amount_cents <= 0) {
    throw new Error("amount_cents must be a positive integer.");
  }
  if (!payload.currency?.trim()) {
    throw new Error("currency is required to create a segment expense.");
  }
  if (!payload.category?.trim()) {
    throw new Error("category is required to create a segment expense.");
  }
}

function formatExpenseRow(row: SegmentExpense): SegmentExpense {
  return {
    ...row,
    amount: (Number(row.amount_cents || 0) / 100).toFixed(2)
  };
}

async function getDefaultSupabaseClient() {
  if (typeof window === "undefined") {
    throw new Error("A Supabase client is required outside the browser.");
  }

  const { getSupabaseClient } = await import("@/lib/supabaseClient");
  return getSupabaseClient();
}
