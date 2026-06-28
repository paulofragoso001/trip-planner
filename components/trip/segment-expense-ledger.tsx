"use client";

export type SegmentExpenseLedgerItem = {
  amount: string;
  category: string;
  id: string;
  title: string;
};

type SegmentExpenseLedgerProps = {
  expenses: SegmentExpenseLedgerItem[];
  totalFormatted: string;
};

export default function SegmentExpenseLedger({
  expenses,
  totalFormatted
}: SegmentExpenseLedgerProps) {
  if (!expenses.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-zinc-800/80 bg-[#1E1E24] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white">Segment Costs</h4>
        <span className="text-sm font-extrabold text-[#E67E22]">
          {formatMoneyLabel(totalFormatted)}
        </span>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {expenses.map((expense) => (
          <div
            className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            key={expense.id}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{expense.title}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                {formatCategoryLabel(expense.category)}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-zinc-300">
              {formatMoneyLabel(expense.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCategoryLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatMoneyLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "$0.00";
  if (/^([A-Z]{3}\s|R\$|[$€£¥])/.test(trimmed)) return trimmed;
  return `$${trimmed}`;
}
