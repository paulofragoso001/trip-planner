import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const currencyCodes = ["USD", "EUR", "GBP", "BRL", "JPY", "CAD"] as const;
const expenseCategories = [
  "transport",
  "lodging",
  "dining",
  "activity",
  "shopping",
  "other"
] as const;

const createExpenseSchema = z
  .object({
    amount: z.coerce.number().finite().positive("Amount must be a positive number decimal."),
    category: z.enum(expenseCategories).optional().default("other"),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .pipe(z.enum(currencyCodes))
      .optional()
      .default("USD"),
    title: z.string().trim().min(1, "Title is a required string.").max(255)
  })
  .strict()
  .transform((value) => ({
    ...value,
    amount_cents: Math.round(value.amount * 100)
  }))
  .refine((value) => value.amount_cents > 0, {
    message: "Amount must resolve to at least one cent.",
    path: ["amount"]
  });

type RouteContext = {
  params: Promise<{ segmentId: string }>;
};

type SegmentExpenseRow = {
  amount_cents: number;
  category: string;
  created_at?: string | null;
  currency: string;
  id: string;
  segment_id: string;
  title: string;
  updated_at?: string | null;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const segmentId = readSegmentId(await params);
  if (!segmentId) {
    return NextResponse.json(
      { error: "Invalid segmentId parameter", success: false },
      { status: 400 }
    );
  }

  const auth = await authorizeDashboardApi();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("trip_segment_expenses")
    .select("id,segment_id,title,amount_cents,currency,category,created_at,updated_at")
    .eq("segment_id", segmentId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch segment ledger", success: false },
      { status: 500 }
    );
  }

  const rows = ((data || []) as SegmentExpenseRow[]).map(formatExpenseRow);
  const totalCents = rows.reduce((acc, row) => acc + row.amount_cents, 0);

  return NextResponse.json({
    expenses: rows,
    segment_id: segmentId,
    success: true,
    total_cents: totalCents,
    total_formatted: formatCents(totalCents)
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const csrfError = validateSessionMutationRequest(request);
  if (csrfError) {
    return csrfError;
  }

  const segmentId = readSegmentId(await params);
  if (!segmentId) {
    return NextResponse.json(
      { error: "Invalid segmentId parameter", success: false },
      { status: 400 }
    );
  }

  const auth = await authorizeDashboardApi();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const body = await readJsonObject(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error, success: false }, { status: 400 });
  }

  const payload = createExpenseSchema.safeParse(body.value);
  if (!payload.success) {
    return NextResponse.json(
      {
        error: "Invalid segment expense payload.",
        issues: payload.error.flatten().fieldErrors,
        success: false
      },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("trip_segment_expenses")
    .insert({
      amount_cents: payload.data.amount_cents,
      category: payload.data.category,
      currency: payload.data.currency,
      segment_id: segmentId,
      title: payload.data.title
    })
    .select("id,segment_id,title,amount_cents,currency,category,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to insert segment expense", success: false },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { expense: formatExpenseRow(data as SegmentExpenseRow), success: true },
    { status: 201 }
  );
}

export function OPTIONS() {
  return new Response(null, {
    headers: { Allow: "GET, POST" },
    status: 204
  });
}

function readSegmentId(params: { segmentId?: string }) {
  const segmentId = params.segmentId?.trim();
  return segmentId || null;
}

async function readJsonObject(request: Request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { error: "Request body must be a JSON object.", ok: false as const };
    }

    return { ok: true as const, value: value as Record<string, unknown> };
  } catch {
    return { error: "Request body must be valid JSON.", ok: false as const };
  }
}

function formatExpenseRow(row: SegmentExpenseRow) {
  return {
    ...row,
    amount: formatCents(row.amount_cents)
  };
}

function formatCents(value: number) {
  return (value / 100).toFixed(2);
}
