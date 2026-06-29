import { NextResponse } from "next/server";
import { z } from "zod";
import { createSegmentExpense, getSegmentExpenses } from "@/lib/db/expenses";
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

  try {
    const ledger = await getSegmentExpenses(segmentId, auth.supabase);
    return NextResponse.json({
      expenses: ledger.expenses,
      segment_id: segmentId,
      success: true,
      total_cents: ledger.totalCents,
      total_formatted: ledger.totalFormatted
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch segment ledger", success: false },
      { status: 500 }
    );
  }
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

  try {
    const expense = await createSegmentExpense(
      {
      amount_cents: payload.data.amount_cents,
      category: payload.data.category,
      currency: payload.data.currency,
      segment_id: segmentId,
      title: payload.data.title
      },
      auth.supabase
    );

    return NextResponse.json({ expense, success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to insert segment expense", success: false },
      { status: 500 }
    );
  }
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
