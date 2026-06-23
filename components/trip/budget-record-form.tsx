"use client";

import { Delete, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

export function BudgetRecordForm({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [label, setLabel] = useState("");
  const [recordType, setRecordType] = useState("actual");
  const { isPending, run, state } = useWaylineAction();
  const numericAmount = Number(amount || 0);
  const canSave = Boolean(label.trim()) && Number.isFinite(numericAmount) && numericAmount > 0 && !isPending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    const result = await run({
      body: {
        amount,
        category,
        currency: "USD",
        label,
        recordType,
        tripId
      },
      method: "POST",
      timeoutMs: 5000,
      url: "/api/budget-records"
    });

    if (result.status === "success") {
      setAmount("");
      setLabel("");
      setOpen(false);
      router.refresh();
    }
  }

  function appendDigit(value: string) {
    setAmount((current) => {
      if (value === "." && current.includes(".")) return current;
      if (value === "." && !current) return "0.";
      const next = `${current}${value}`;
      const [whole, cents = ""] = next.split(".");
      if (whole.replace(/^0+/, "").length > 7 || cents.length > 2) return current;
      return next.replace(/^0+(?=\d)/, "");
    });
  }

  function backspace() {
    setAmount((current) => current.slice(0, -1));
  }

  function cancel() {
    setOpen(false);
  }

  const message = state.status === "success" ? "Expense saved." : state.message;
  const amountLabel = new Intl.NumberFormat("en-US", {
    currency: "USD",
    minimumFractionDigits: 2,
    style: "currency"
  }).format(numericAmount || 0);
  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <>
      <button
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-5 text-sm font-black text-white shadow-[0_18px_38px_rgba(249,115,22,0.22)] lg:hidden"
        data-testid="mobile-add-expense-button"
        disabled={!hydrated}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        Add expense
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-[#1f1f21] text-white lg:hidden" data-testid="mobile-expense-amount-sheet">
          <form className="flex min-h-[100svh] flex-col" onSubmit={submit}>
            <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 pt-[calc(0.85rem+env(safe-area-inset-top))]">
              <button
                className="min-h-11 text-sm font-black text-orange-400"
                onClick={cancel}
                type="button"
              >
                Cancel
              </button>
              <div className="min-w-0 text-center">
                <p className="text-sm font-black text-white">Total Cost</p>
                <input
                  aria-label="Expense title"
                  className="mt-0.5 w-full bg-transparent text-center text-sm font-semibold text-white/46 outline-none placeholder:text-white/34"
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Expense name"
                  required
                  value={label}
                />
              </div>
              <button
                className="min-h-11 rounded-full bg-orange-500 px-4 text-sm font-black text-white disabled:opacity-45"
                disabled={!canSave}
                type="submit"
              >
                {isPending ? "Saving" : "Save"}
              </button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-5 pb-6 pt-4">
              <div className="text-center">
                <div className="inline-flex items-baseline">
                  <span className="text-6xl font-light tracking-tight text-white">{amountLabel}</span>
                  <span className="ml-1 h-14 w-px translate-y-2 animate-pulse bg-orange-500" aria-hidden="true" />
                </div>
                <p className="mt-8 text-sm font-black text-orange-400">US Dollar (USD)</p>
              </div>

              <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-2">
                {keypad.map((key) => (
                  <button
                    className="min-h-12 rounded-md bg-white/34 text-2xl font-medium text-white active:bg-white/45"
                    key={key}
                    onClick={() => appendDigit(key)}
                    type="button"
                  >
                    {key}
                  </button>
                ))}
                <button
                  aria-label="Backspace amount"
                  className="grid min-h-12 place-items-center rounded-md bg-white/20 text-white active:bg-white/32"
                  onClick={backspace}
                  type="button"
                >
                  <Delete className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {expenseCategories.map((option) => (
                  <button
                    aria-pressed={category === option.value}
                    className={[
                      "min-h-9 rounded-full px-3 text-xs font-black",
                      category === option.value
                        ? "bg-orange-500 text-white"
                        : "bg-white/10 text-white/62"
                    ].join(" ")}
                    key={option.value}
                    onClick={() => setCategory(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {state.status !== "idle" && message ? (
                <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/72">
                  {message}
                </p>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      <form className="mt-4 hidden gap-3 rounded-2xl bg-slate-50 p-3 lg:grid" onSubmit={submit}>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Title
          <input
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-800"
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Expense label"
            required
            value={label}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Amount
            <input
              className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-800"
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Amount"
              required
              value={amount}
            />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Category
            <select
              className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-800"
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              {expenseCategories.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Type
          <select
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-800"
            onChange={(event) => setRecordType(event.target.value)}
            value={recordType}
          >
            <option value="actual">Actual</option>
            <option value="planned">Planned</option>
          </select>
        </label>
        <button
          className="min-h-11 rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
          disabled={!canSave}
          type="submit"
        >
          {isPending ? "Saving..." : "Add expense"}
        </button>
        {state.status !== "idle" && message ? (
          <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            {message}
          </p>
        ) : null}
      </form>
    </>
  );
}

const expenseCategories = [
  { label: "Bar & Party", value: "bar-party" },
  { label: "Flight", value: "flight" },
  { label: "Lodging", value: "lodging" },
  { label: "Restaurant", value: "restaurant" },
  { label: "Transport", value: "transport" },
  { label: "Activity", value: "activity" },
  { label: "Other", value: "other" }
];
