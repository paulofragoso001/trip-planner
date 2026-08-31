"use client";

import { AlmidyButton } from "@/components/ui/almidy-button";
import { AlmidyCard } from "@/components/ui/almidy-card";
import { AlmidyInput } from "@/components/ui/almidy-form-control";

export function TierBVisualFixture({ componentsOnly = false }: { componentsOnly?: boolean }) {
  if (componentsOnly) {
    return (
      <main className="min-h-screen bg-slate-100 p-8" data-testid="tier-b-visual-fixture">
        <div className="mx-auto max-w-5xl">
          <ComponentsFixture />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8" data-testid="tier-b-visual-fixture">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
        <Fixture title="Warm trip neutrals" testId="tier-b-warm">
          <div className="rounded-3xl bg-[#faf8f5] p-6 text-[#221d17]">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a8175]">Lisbon · May 18–24</p>
            <h2 className="mt-2 text-3xl font-black">A quiet week by the water</h2>
            <p className="mt-3 leading-6 text-[#6f675c]">Saved places, flight details, and a flexible afternoon itinerary.</p>
            <div className="mt-5 rounded-2xl bg-[#f7f6f2] p-4 text-sm font-semibold text-[#6f675c]">Three activities planned</div>
          </div>
        </Fixture>

        <Fixture dark title="Mobile dark neutrals" testId="tier-b-dark">
          <div className="w-[342px] rounded-[2rem] bg-almidy-dark-canvas p-5 text-white">
            <h2 className="text-2xl font-black">Your trips</h2>
            <div className="mt-4 rounded-2xl bg-almidy-dark-surface p-4">
              <p className="text-sm font-bold">Tokyo</p>
              <p className="mt-1 text-sm text-white/60">October 4–11</p>
            </div>
            <label className="mt-4 block text-xs font-bold text-white/70">
              Search
              <input className="mt-2 h-12 rounded-xl border border-white/10 bg-almidy-dark-input-surface px-3 text-white placeholder:text-white/45 focus:bg-almidy-dark-surface-neutral" placeholder="Find a trip" />
            </label>
          </div>
        </Fixture>

        <Fixture title="Keyboard focus" testId="tier-b-focus">
          <div className="rounded-3xl bg-white p-6">
            <label className="block text-sm font-bold text-slate-800">
              Destination
              <input
                autoFocus
                className="mt-2 h-12 rounded-xl border border-orange-400/70 px-3 text-slate-950 outline-none ring-4 ring-blue-100"
                defaultValue="Kyoto"
                data-testid="tier-b-focused-input"
              />
            </label>
          </div>
        </Fixture>

        <Fixture title="Selected state" testId="tier-b-selected">
          <div className="grid grid-cols-2 gap-4 rounded-3xl bg-white p-6">
            <button className="rounded-2xl border border-almidy-accent bg-almidy-accent-muted-surface p-4 text-left text-almidy-text-primary ring-2 ring-almidy-accent/20">
              <span className="block font-black">Selected</span>
              <span className="mt-1 block text-sm">Window seat</span>
            </button>
            <button className="rounded-2xl border border-black/10 bg-white p-4 text-left text-slate-700">
              <span className="block font-black">Available</span>
              <span className="mt-1 block text-sm">Aisle seat</span>
            </button>
          </div>
        </Fixture>

        <Fixture title="Raised panel" testId="tier-b-shadow">
          <div className="rounded-3xl bg-white p-6 shadow-panel">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Upcoming</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Flight to Copenhagen</h2>
            <p className="mt-2 text-sm text-slate-600">Boarding begins at 18:40 from Gate B12.</p>
          </div>
        </Fixture>
      </div>

      <div className="mx-auto mt-8 grid max-w-5xl items-start gap-8 lg:grid-cols-2">
        <Fixture title="Trip editorial hierarchy" testId="typography-trip">
          <article className="rounded-3xl bg-[#faf8f5] p-6 text-[#221d17]">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a8175]">Barcelona · September 12–18</p>
            <h1 className="mt-2 text-almidy-display-hero">A week shaped by the city</h1>
            <p className="mt-4 max-w-xl text-almidy-body text-[#6f675c]">
              Morning markets, long lunches, and an open afternoon beside the Mediterranean.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8a8175]">Next</p>
                <h2 className="mt-1 text-almidy-card-title">Casa Batlló</h2>
                <p className="mt-1 text-almidy-metadata text-[#6f675c]">10:30 · Passeig de Gràcia</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8a8175]">Later</p>
                <h2 className="mt-1 text-almidy-card-title">Dinner at Compartir</h2>
                <p className="mt-1 text-almidy-metadata text-[#6f675c]">20:00 · Eixample</p>
              </div>
            </div>
          </article>
        </Fixture>

        <Fixture title="Account form hierarchy" testId="typography-auth">
          <form className="rounded-3xl bg-white p-6" onSubmit={(event) => event.preventDefault()}>
            <h1 className="text-almidy-screen-title text-slate-950">Welcome back</h1>
            <p className="mt-2 text-almidy-body-compact text-slate-600">Sign in to continue planning your next trip.</p>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Email address
              <AlmidyInput className="mt-2 text-almidy-body-compact" defaultValue="traveler@example.com" type="email" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Password
              <AlmidyInput className="mt-2 text-almidy-body-compact" defaultValue="instrument-sans" type="password" />
            </label>
            <AlmidyButton className="mt-5 w-full" type="submit">
              Sign in
            </AlmidyButton>
            <p className="mt-4 text-center text-xs text-slate-500">Protected by secure account access.</p>
          </form>
        </Fixture>
      </div>

    </main>
  );
}

function ComponentsFixture() {
  return (
    <Fixture title="Ordinary component semantics" testId="web-components-light">
          <div className="grid gap-5 rounded-3xl bg-white p-6 text-slate-950">
            <div className="flex flex-wrap gap-3">
              <AlmidyButton type="button">
                Primary action
              </AlmidyButton>
              <AlmidyButton size="compact" type="button" variant="neutral">
                Neutral action
              </AlmidyButton>
              <AlmidyButton disabled type="button">
                Disabled action
              </AlmidyButton>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-950">
                Destination
                <AlmidyInput defaultValue="Copenhagen" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-950">
                Confirmation
                <AlmidyInput aria-describedby="fixture-error" aria-invalid="true" defaultValue="Needs review" />
                <span className="text-xs text-red-700" id="fixture-error">Check this value before continuing.</span>
              </label>
            </div>
            <AlmidyCard>
              <span className="rounded-full bg-almidy-accent-muted-surface px-2.5 py-1 text-almidy-badge text-almidy-text-primary">UPCOMING</span>
              <h2 className="mt-3 text-almidy-section-title">Ordinary travel card</h2>
              <p className="mt-1 text-almidy-body-compact text-slate-600">Reusable surface semantics without feature-owned composition.</p>
            </AlmidyCard>
            <section className="rounded-2xl border border-dashed border-almidy-border-subtle px-5 py-6 text-center">
              <h2 className="text-almidy-card-title">No saved places yet</h2>
              <p className="mt-1 text-almidy-body-compact text-slate-600">Save a place when it belongs in this trip.</p>
            </section>
          </div>
    </Fixture>
  );
}

function Fixture({ children, dark = false, testId, title }: { children: React.ReactNode; dark?: boolean; testId: string; title: string }) {
  return (
    <section className={dark ? "rounded-[2rem] bg-almidy-dark-canvas-grouped p-5" : "rounded-[2rem] bg-slate-200 p-5"} data-testid={testId}>
      <p className={dark ? "mb-3 text-xs font-black uppercase tracking-[0.14em] text-white/55" : "mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500"}>{title}</p>
      {children}
    </section>
  );
}
