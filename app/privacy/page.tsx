import Link from "next/link";

const lastUpdated = "May 26, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f4f7fb] px-6 py-10 text-ink">
      <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-panel sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Wayline legal
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {lastUpdated}</p>

        <div className="mt-8 grid gap-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-black text-ink">Overview</h2>
            <p className="mt-2">
              Wayline helps users organize trips, itinerary segments, imports,
              budgets, sharing, and calendar sync. This policy describes the data
              we collect, why we collect it, and the choices available to users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Data We Process</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Account data, such as email address and profile information.</li>
              <li>Trip data, such as destinations, dates, itinerary items, budgets, and collaborator roles.</li>
              <li>Imported travel content, such as email, PDF, calendar, or manually entered unfiled items.</li>
              <li>Calendar connection metadata, OAuth scopes, encrypted tokens, sync status, and external event IDs.</li>
              <li>Operational logs and audit events, such as OAuth, import parsing, sync, API, and security events.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">How We Use Data</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>To create, store, and display trip workspaces.</li>
              <li>To classify imported travel records and help convert them into itinerary items.</li>
              <li>To sync selected trip segments to connected Google or Microsoft calendars.</li>
              <li>To send account, invite, or operational notifications.</li>
              <li>To monitor reliability, security, abuse prevention, and product quality.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Calendar Access</h2>
            <p className="mt-2">
              If you connect Google Calendar or Outlook Calendar, Wayline uses
              calendar event permissions to create, update, and delete Wayline
              trip events that you choose to sync. Provider tokens are stored
              server-side and encrypted at rest. We do not expose provider tokens
              to browser clients.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Service Providers</h2>
            <p className="mt-2">
              Wayline may use infrastructure and integration providers including
              Supabase, Resend, Google APIs, Microsoft Graph, Google Maps, and
              flight-status data providers. These providers process data only as
              needed to deliver the app features they support.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Retention and Deletion</h2>
            <p className="mt-2">
              Trip and account records are retained while your account is active
              or as needed for security, legal, or operational requirements. You
              can request account and data deletion from the Account page. We will
              review and process deletion requests according to applicable legal
              and operational requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink">Contact</h2>
            <p className="mt-2">
              For privacy questions or deletion requests, use the in-app Account
              page or contact the Wayline operator for this deployment.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5">
          <Link className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white" href="/dashboard">
            Open dashboard
          </Link>
          <Link className="rounded-lg border border-line px-4 py-2 text-sm font-bold" href="/terms">
            Terms
          </Link>
        </div>
      </article>
    </main>
  );
}
