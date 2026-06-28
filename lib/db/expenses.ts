"use client";

import { getSupabaseClient } from "@/lib/supabaseClient";

export interface SegmentExpense {
  amount_cents: number;
  category: string;
  currency: string;
  id: string;
  segment_id: string;
  title: string;
}

type SegmentExpenseInsert = Omit<SegmentExpense, "id">;

const expenseColumns = "id,segment_id,title,amount_cents,currency,category";

export async function getSegmentExpenses(segmentId: string) {
  const safeSegmentId = segmentId.trim();
  if (!safeSegmentId) {
    throw new Error("segmentId is required to fetch segment expenses.");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("trip_segment_expenses")
    .select(expenseColumns)
    .eq("segment_id", safeSegmentId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase fetch failure on segment expenses:", error.message);
    throw new Error(error.message);
  }

  const expenses = (data || []) as SegmentExpense[];
  const totalCents = expenses.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);

  return {
    expenses,
    totalFormatted: (totalCents / 100).toFixed(2)
  };
}

export async function createSegmentExpense(payload: SegmentExpenseInsert) {
  validateSegmentExpensePayload(payload);

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("trip_segment_expenses")
    .insert([payload])
    .select(expenseColumns)
    .single();

  if (error) {
    console.error("Supabase write failure on segment expense insert:", error.message);
    throw new Error(error.message);
  }

  return data as SegmentExpense;
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
