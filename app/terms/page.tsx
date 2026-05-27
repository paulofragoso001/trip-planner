import Link from "next/link";

const lastUpdated = "May 26, 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f4f7fb] px-6 py-10 text-ink">
      <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-panel sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Wayline legal
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {lastUpdated}</p>

        <div className="mt-8 grid gap-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-black text-ink">Use of Wayline</h2>
            <p className="mt-2">
              Wayline is a travel planning and operations tool. You are responsible
              for the accuracy of trip, budget, itinerary, import, and sharing
              information you add or approve in the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Accounts and Security</h2>
            <p className="mt-2">
              You must keep your account credentials secure and only connect
              calendar, email, or import accounts you are authorized to use. You
              are responsible for activity performed through your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Connected Services</h2>
            <p className="mt-2">
              Google Calendar, Microsoft Calendar, maps, email, and flight-data
              integrations may be subject to their own provider terms and
              availability. Wayline is not responsible for provider outages,
              provider policy changes, or incorrect data returned by third-party
              services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Data and Content</h2>
            <p className="mt-2">
              You retain responsibility for the content you submit to Wayline.
              You grant Wayline the limited right to process that content to
              provide app features, including imports, calendar sync, sharing,
              notifications, and operational monitoring.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">No Travel Guarantee</h2>
            <p className="mt-2">
              Wayline may help organize travel information, but it does not book,
              guarantee, insure, or operate flights, hotels, meetings, or other
              travel services. Always confirm critical travel details with the
              provider of record.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Termination and Deletion</h2>
            <p className="mt-2">
              You may stop using Wayline at any time and request account deletion
              from the Account page. Wayline may suspend access for misuse,
              unauthorized activity, security risk, or legal compliance reasons.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Changes</h2>
            <p className="mt-2">
              These terms may be updated as Wayline evolves. Material changes
              should be communicated through the app or the deployment operator.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5">
          <Link className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white" href="/dashboard">
            Open dashboard
          </Link>
          <Link className="rounded-lg border border-line px-4 py-2 text-sm font-bold" href="/privacy">
            Privacy
          </Link>
        </div>
      </article>
    </main>
  );
}
