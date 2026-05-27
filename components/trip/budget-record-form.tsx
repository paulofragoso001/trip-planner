"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

export function BudgetRecordForm({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [label, setLabel] = useState("");
  const [recordType, setRecordType] = useState("actual");
  const { isPending, run, state } = useWaylineAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      router.refresh();
    }
  }

  const message = state.status === "success" ? "Budget record saved." : state.message;

  return (
    <form className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-3" onSubmit={submit}>
      <input
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Expense label"
        required
        value={label}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Amount"
          required
          value={amount}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          onChange={(event) => setCategory(event.target.value)}
          value={category}
        >
          <option value="flights">Flights</option>
          <option value="lodging">Lodging</option>
          <option value="food">Food</option>
          <option value="ground">Ground</option>
          <option value="meetings">Meetings</option>
          <option value="misc">Misc</option>
        </select>
      </div>
      <select
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        onChange={(event) => setRecordType(event.target.value)}
        value={recordType}
      >
        <option value="actual">Actual</option>
        <option value="planned">Planned</option>
      </select>
      <button
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        disabled={isPending}
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
  );
}
