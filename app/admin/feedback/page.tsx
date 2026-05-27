"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type FeedbackRow = {
  id: string;
  trip_id: string | null;
  rating: number;
  comment: string | null;
  context: string | null;
  created_at: string;
};

export default function FeedbackAdminPage() {
  const sb = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        setLoading(false);
        setError("You must be signed in as the founder to view feedback.");
        return;
      }

      const { data, error } = await sb
        .from("feedback")
        .select("id, trip_id, rating, comment, context, created_at")
        .order("created_at", { ascending: false });

      setLoading(false);

      if (error) {
        console.error("Error loading feedback", error);
        setError("Could not load feedback.");
        return;
      }

      setRows((data || []) as FeedbackRow[]);
    }

    load();
  }, [sb]);

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-[#221d17] md:px-6">
      <div className="mx-auto grid max-w-5xl gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-black/10 bg-[#fcfbf7] p-5 shadow-panel">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9d9589]">Founder view</p>
            <h1 className="mt-1 text-3xl font-black">Alpha feedback</h1>
            <p className="mt-2 text-sm text-[#6f675c]">Founder-only view of timeline feedback captured in the app.</p>
          </div>
        </header>

        {loading ? <p className="rounded-2xl bg-[#fcfbf7] p-4 text-sm font-semibold text-[#6f675c] shadow-panel">Loading feedback...</p> : null}
        {error && !loading ? <p className="rounded-2xl bg-[#fcfbf7] p-4 text-sm font-semibold text-[#6f675c] shadow-panel">{error}</p> : null}

        {!loading && !error && rows.length === 0 ? (
          <p className="rounded-2xl bg-[#fcfbf7] p-4 text-sm font-semibold text-[#6f675c] shadow-panel">No feedback yet.</p>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <section className="rounded-[24px] border border-black/10 bg-[#fcfbf7] p-5 shadow-panel">
            <h2 className="text-xl font-black">Submissions</h2>
            <div className="mt-3 grid gap-3">
              {rows.map((row) => (
                <article className="rounded-2xl border border-black/5 bg-[#f9f6f0] p-4 text-sm" key={row.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-wide text-[#7a7974]">
                      Rating: <strong>{row.rating}</strong>
                      {row.context ? ` - ${row.context}` : ""}
                    </div>
                    <div className="text-xs text-[#7a7974]">{new Date(row.created_at).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-xs text-[#7a7974]">
                    trip_id: <code className="text-[10px]">{row.trip_id || "none"}</code>
                  </div>
                  {row.comment ? <p className="mt-2 whitespace-pre-line text-[#49463b]">{row.comment}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
