"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/components/trip-ui";

export type SidebarMode = "expanded" | "collapsed" | "mobile";
export type ThemeMode = "light" | "dark";
export type Accent = "teal" | "blue" | "amber" | "rose";
export type Density = "compact" | "comfortable";
export type TopBarMode = "minimal" | "breadcrumbs" | "trip-context" | "filter-heavy";
export type ContentLayout =
  | "single"
  | "kpi"
  | "split"
  | "map-list"
  | "timeline-inspector"
  | "ops-3-panel";
export type RailMode = "on" | "off";
export type ContainerWidth = "default" | "wide" | "full";
export type CardRadius = "subtle" | "medium" | "rounded";
export type MockPreset = "overview" | "trip-detail" | "import-queue" | "flight-monitor" | "map-workspace";

export type SimulatorState = {
  accent: Accent;
  cardRadius: CardRadius;
  containerWidth: ContainerWidth;
  contentLayout: ContentLayout;
  density: Density;
  mockPreset: MockPreset;
  rightRail: RailMode;
  sidebarMode: SidebarMode;
  theme: ThemeMode;
  topBarMode: TopBarMode;
};

export type LayoutIntegrityPresetScore = {
  name: string;
  score: number;
  status: string;
};

export type LayoutIntegrityScorecard = {
  averageScore: number;
  generatedAt: string;
  presets: LayoutIntegrityPresetScore[];
};

const initialState: SimulatorState = {
  accent: "teal",
  cardRadius: "medium",
  containerWidth: "wide",
  contentLayout: "ops-3-panel",
  density: "compact",
  mockPreset: "flight-monitor",
  rightRail: "on",
  sidebarMode: "expanded",
  theme: "light",
  topBarMode: "trip-context"
};

export const dashboardLayoutReferencePresets = {
  "collapsed-right-rail": {
    ...initialState,
    contentLayout: "timeline-inspector",
    mockPreset: "trip-detail",
    rightRail: "on",
    sidebarMode: "collapsed",
    topBarMode: "trip-context"
  },
  "flight-monitor": {
    ...initialState,
    contentLayout: "ops-3-panel",
    mockPreset: "flight-monitor",
    rightRail: "on",
    topBarMode: "trip-context"
  },
  "mobile-drawer": {
    ...initialState,
    contentLayout: "single",
    mockPreset: "overview",
    rightRail: "off",
    sidebarMode: "mobile",
    topBarMode: "minimal"
  },
  "map-inspector-stress": {
    ...initialState,
    contentLayout: "ops-3-panel",
    containerWidth: "full",
    mockPreset: "map-workspace",
    rightRail: "on",
    sidebarMode: "collapsed",
    theme: "dark",
    topBarMode: "filter-heavy"
  },
  "trip-detail": {
    ...initialState,
    contentLayout: "timeline-inspector",
    containerWidth: "wide",
    mockPreset: "trip-detail",
    rightRail: "on",
    topBarMode: "trip-context"
  },
  "wide-map-workspace": {
    ...initialState,
    contentLayout: "map-list",
    containerWidth: "full",
    mockPreset: "map-workspace",
    rightRail: "off",
    topBarMode: "filter-heavy"
  }
} satisfies Record<string, SimulatorState>;

export type DashboardLayoutReferencePreset = keyof typeof dashboardLayoutReferencePresets;

function isDashboardLayoutReferencePreset(value: string | null): value is DashboardLayoutReferencePreset {
  return Boolean(value && value in dashboardLayoutReferencePresets);
}

const accentStyles = {
  amber: {
    bg: "bg-amber-500",
    border: "border-amber-300",
    muted: "bg-amber-50 text-amber-800 ring-amber-100",
    text: "text-amber-700"
  },
  blue: {
    bg: "bg-blue-600",
    border: "border-blue-300",
    muted: "bg-blue-50 text-blue-700 ring-blue-100",
    text: "text-blue-700"
  },
  rose: {
    bg: "bg-rose-500",
    border: "border-rose-300",
    muted: "bg-rose-50 text-rose-700 ring-rose-100",
    text: "text-rose-700"
  },
  teal: {
    bg: "bg-teal-600",
    border: "border-teal-300",
    muted: "bg-teal-50 text-teal-700 ring-teal-100",
    text: "text-teal-700"
  }
} as const;

const radiusStyles = {
  medium: "rounded-xl",
  rounded: "rounded-2xl",
  subtle: "rounded-md"
} as const;

const navGroups = [
  {
    label: "Flight Ops",
    items: ["Overview", "Trips", "Itinerary", "Imports", "Flight Status", "Map"]
  },
  {
    label: "Signals",
    items: ["Alerts", "Reports", "Settings"]
  }
];

const pagePresetLabels: Record<MockPreset, string> = {
  "flight-monitor": "Flight Monitor",
  "import-queue": "Import Queue",
  "map-workspace": "Map Workspace",
  overview: "Overview",
  "trip-detail": "Trip Detail"
};

export function DashboardLayoutSimulator({
  scorecard
}: {
  scorecard?: LayoutIntegrityScorecard | null;
}) {
  const searchParams = useSearchParams();
  const initialPresetKey = searchParams.get("preset");
  const queryPreset = isDashboardLayoutReferencePreset(initialPresetKey)
    ? dashboardLayoutReferencePresets[initialPresetKey]
    : initialState;
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<SimulatorState>(queryPreset);
  const accent = accentStyles[state.accent];
  const radius = radiusStyles[state.cardRadius];
  const compact = state.density === "compact";
  const dark = state.theme === "dark";

  const previewClasses = cn(
    "overflow-hidden border shadow-panel transition-colors",
    radius,
    dark
      ? "border-white/10 bg-[#0b1120] text-slate-100"
      : "border-black/10 bg-[#f6f8fb] text-slate-950"
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div className="grid gap-5" data-hydrated={hydrated ? "true" : "false"} data-testid="layout-simulator">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Flight operations layout lab
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">
            App shell simulator
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Tune the persistent sidebar, top bar, density, content layout, and inspector rail
            before those choices become production route chrome.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {scorecard ? <LayoutIntegrityCard scorecard={scorecard} /> : null}
          <button
            className="min-h-11 rounded-xl border border-black/10 bg-white px-4 text-sm font-black shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-brand/20 dark:border-white/10 dark:bg-[#111827]"
            onClick={() => setState(initialState)}
            type="button"
          >
            Reset simulator
          </button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SimulatorControls state={state} onChange={setState} />

        <section
          aria-label="Live layout preview"
          className={previewClasses}
          data-accent={state.accent}
          data-card-radius={state.cardRadius}
          data-container-width={state.containerWidth}
          data-content-layout={state.contentLayout}
          data-density={state.density}
          data-mock-preset={state.mockPreset}
          data-right-rail={state.rightRail}
          data-sidebar-mode={state.sidebarMode}
          data-testid="layout-preview-shell"
          data-theme={state.theme}
          data-topbar-mode={state.topBarMode}
        >
          <div
            className={cn(
              "grid min-h-[760px] transition-[grid-template-columns] duration-300 motion-reduce:transition-none",
              state.sidebarMode === "expanded" && "grid-cols-[240px_minmax(0,1fr)]",
              state.sidebarMode === "collapsed" && "grid-cols-[76px_minmax(0,1fr)]",
              state.sidebarMode === "mobile" && "grid-cols-1"
            )}
          >
            {state.sidebarMode !== "mobile" ? (
              <PreviewSidebar accent={accent} collapsed={state.sidebarMode === "collapsed"} dark={dark} />
            ) : null}

            <div className="relative flex min-w-0 flex-col">
              {state.sidebarMode === "mobile" ? (
                <MobileDrawerPreview accent={accent} dark={dark} radius={radius} />
              ) : null}
              <PreviewTopBar accent={accent} compact={compact} mode={state.topBarMode} page={pagePresetLabels[state.mockPreset]} />
              <main
                className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "p-3" : "p-5")}
                data-testid="layout-preview-main"
              >
                <div
                  className={cn(
                    "mx-auto grid gap-3",
                    state.containerWidth === "default" && "max-w-5xl",
                    state.containerWidth === "wide" && "max-w-7xl",
                    state.containerWidth === "full" && "max-w-none"
                  )}
                  data-testid="layout-preview-content"
                >
                  <OperationalStatus accent={accent} compact={compact} radius={radius} />
                  <ContentPreset
                    accent={accent}
                    compact={compact}
                    layout={state.contentLayout}
                    preset={state.mockPreset}
                    radius={radius}
                    rightRail={state.rightRail}
                  />
                  <PreviewStates accent={accent} radius={radius} />
                </div>
              </main>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function LayoutIntegrityCard({ scorecard }: { scorecard: LayoutIntegrityScorecard }) {
  const cleanPresets = scorecard.presets.filter((preset) => preset.score === 100).length;

  return (
    <aside
      aria-label="Layout integrity scorecard"
      className="min-w-[260px] rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#111827]"
      data-testid="layout-integrity-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
            Layout integrity
          </p>
          <p className="mt-1 font-mono text-2xl font-black tabular-nums">
            {scorecard.averageScore}
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">
          {cleanPresets}/{scorecard.presets.length} clean
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {scorecard.presets.map((preset) => (
          <span
            className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600 dark:bg-white/10 dark:text-slate-200"
            key={preset.name}
          >
            {preset.name}: {preset.score}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Baseline and latest scorecard are published as CI artifacts.
      </p>
    </aside>
  );
}

function SimulatorControls({
  onChange,
  state
}: {
  onChange: (state: SimulatorState) => void;
  state: SimulatorState;
}) {
  return (
    <aside
      aria-label="Simulator controls"
      className="h-fit rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#111827]"
      data-testid="layout-simulator-controls"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Controls
          </p>
          <h3 className="mt-1 text-xl font-black">Layout settings</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
          Live
        </span>
      </div>

      <div className="mt-4 grid gap-2 rounded-xl border border-black/10 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          Reference layouts
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {Object.entries(dashboardLayoutReferencePresets).map(([key, preset]) => (
            <button
              className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-left text-xs font-black capitalize shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-brand/20 dark:border-white/10 dark:bg-[#0b1120] dark:hover:bg-white/10"
              data-testid={`layout-reference-${key}`}
              key={key}
              onClick={() => onChange(preset)}
              type="button"
            >
              {key.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <ControlSelect
          label="Sidebar mode"
          value={state.sidebarMode}
          values={["expanded", "collapsed", "mobile"]}
          onChange={(sidebarMode) => onChange({ ...state, sidebarMode })}
        />
        <ControlSelect
          label="Theme"
          value={state.theme}
          values={["light", "dark"]}
          onChange={(theme) => onChange({ ...state, theme })}
        />
        <ControlSelect
          label="Accent color"
          value={state.accent}
          values={["teal", "blue", "amber", "rose"]}
          onChange={(accent) => onChange({ ...state, accent })}
        />
        <ControlSelect
          label="Density"
          value={state.density}
          values={["compact", "comfortable"]}
          onChange={(density) => onChange({ ...state, density })}
        />
        <ControlSelect
          label="Top bar mode"
          value={state.topBarMode}
          values={["minimal", "breadcrumbs", "trip-context", "filter-heavy"]}
          onChange={(topBarMode) => onChange({ ...state, topBarMode })}
        />
        <ControlSelect
          label="Content layout"
          value={state.contentLayout}
          values={["single", "kpi", "split", "map-list", "timeline-inspector", "ops-3-panel"]}
          onChange={(contentLayout) => onChange({ ...state, contentLayout })}
        />
        <ControlSelect
          label="Right rail"
          value={state.rightRail}
          values={["on", "off"]}
          onChange={(rightRail) => onChange({ ...state, rightRail })}
        />
        <ControlSelect
          label="Container width"
          value={state.containerWidth}
          values={["default", "wide", "full"]}
          onChange={(containerWidth) => onChange({ ...state, containerWidth })}
        />
        <ControlSelect
          label="Card radius"
          value={state.cardRadius}
          values={["subtle", "medium", "rounded"]}
          onChange={(cardRadius) => onChange({ ...state, cardRadius })}
        />
        <ControlSelect
          label="Mock page preset"
          value={state.mockPreset}
          values={["overview", "trip-detail", "import-queue", "flight-monitor", "map-workspace"]}
          onChange={(mockPreset) => onChange({ ...state, mockPreset })}
        />
      </div>
    </aside>
  );
}

function ControlSelect<TValue extends string>({
  label,
  onChange,
  value,
  values
}: {
  label: string;
  onChange: (value: TValue) => void;
  value: TValue;
  values: TValue[];
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      <span>{label}</span>
      <select
        className="h-11 rounded-xl border-black/10 bg-[#f8fafc] text-sm capitalize focus:outline-none focus:ring-4 focus:ring-brand/20 dark:border-white/10 dark:bg-[#0b1120]"
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {item.replaceAll("-", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewSidebar({
  accent,
  collapsed,
  dark
}: {
  accent: (typeof accentStyles)[Accent];
  collapsed: boolean;
  dark: boolean;
}) {
  return (
    <nav
      aria-label="Preview primary navigation"
      className={cn(
        "flex min-h-0 flex-col border-r p-3",
        dark ? "border-white/10 bg-[#111827]" : "border-black/10 bg-white"
      )}
      data-testid="layout-preview-sidebar"
    >
      <div className="flex h-12 items-center gap-3">
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl text-sm font-black text-white", accent.bg)}>
          F
        </span>
        {!collapsed ? (
          <span>
            <span className="block text-sm font-black">Flight Ops</span>
            <span className="block text-xs text-slate-500">AAL 123 context</span>
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                {group.label}
              </p>
            ) : null}
            <div className="grid gap-1">
              {group.items.map((item) => {
                const active = item === "Flight Status";
                return (
                  <button
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-brand/20",
                      collapsed && "justify-center px-0",
                      active ? `${accent.bg} text-white` : "hover:bg-slate-100 dark:hover:bg-white/10"
                    )}
                    key={item}
                    title={collapsed ? item : undefined}
                    type="button"
                  >
                    <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-xs font-black", active ? "bg-white/20" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200")}>
                      {item[0]}
                    </span>
                    {!collapsed ? <span className="truncate">{item}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-black/10 pt-3 dark:border-white/10">
        <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-brand/20 dark:hover:bg-white/10" type="button">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-xs dark:bg-white/10">
            W
          </span>
          {!collapsed ? (
            <span>
              <span className="block">Dispatch Desk</span>
              <span className="block text-xs text-slate-500">Switch workspace</span>
            </span>
          ) : null}
        </button>
      </div>
    </nav>
  );
}

function MobileDrawerPreview({
  accent,
  dark,
  radius
}: {
  accent: (typeof accentStyles)[Accent];
  dark: boolean;
  radius: string;
}) {
  return (
    <div className="absolute inset-0 z-20 bg-black/30 p-3" data-testid="layout-preview-mobile-drawer">
      <div className={cn("h-full w-[280px] border p-3 shadow-panel", radius, dark ? "border-white/10 bg-[#111827]" : "border-black/10 bg-white")}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-black">Mobile drawer</span>
          <button className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 font-black dark:border-white/10" type="button">
            x
          </button>
        </div>
        <div className="mt-4">
          <PreviewSidebar accent={accent} collapsed={false} dark={dark} />
        </div>
      </div>
    </div>
  );
}

function PreviewTopBar({
  accent,
  compact,
  mode,
  page
}: {
  accent: (typeof accentStyles)[Accent];
  compact: boolean;
  mode: TopBarMode;
  page: string;
}) {
  return (
    <header
      className={cn("border-b border-black/10 bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-[#0b1120]/90", compact ? "py-3" : "py-4")}
      data-testid="layout-preview-topbar"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          {mode !== "minimal" ? (
            <nav className="flex gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500" aria-label="Preview breadcrumbs">
              <span>Ops</span>
              <span>/</span>
              <span>{page}</span>
            </nav>
          ) : null}
          <h3 className="mt-1 text-xl font-black">{page}</h3>
        </div>

        {mode === "trip-context" || mode === "filter-heavy" ? (
          <span className={cn("rounded-full px-3 py-1 text-xs font-black ring-1", accent.muted)}>
            AAL 123 · JFK to MIA
          </span>
        ) : null}

        {mode === "filter-heavy" ? (
          <div className="flex flex-wrap gap-2">
            {["Today", "Delayed", "Terminal 8"].map((filter) => (
              <button className="min-h-11 rounded-xl border border-black/10 px-3 text-xs font-black focus:outline-none focus:ring-4 focus:ring-brand/20 dark:border-white/10" key={filter} type="button">
                {filter}
              </button>
            ))}
          </div>
        ) : null}

        <button className="min-h-11 rounded-xl border border-black/10 px-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand/20 dark:border-white/10" type="button">
          Search
        </button>
        <button className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 font-black focus:outline-none focus:ring-4 focus:ring-brand/20 dark:border-white/10" type="button">
          N
        </button>
      </div>
    </header>
  );
}

function OperationalStatus({
  accent,
  compact,
  radius
}: {
  accent: (typeof accentStyles)[Accent];
  compact: boolean;
  radius: string;
}) {
  const stats = [
    ["Active flights", "18", "+3"],
    ["Delayed", "4", "amber"],
    ["Imports queued", "27", "steady"],
    ["Map freshness", "22s", "live"]
  ];

  return (
    <section
      className={cn("grid gap-3 md:grid-cols-4", compact ? "text-sm" : "text-base")}
      data-testid="layout-preview-kpis"
      aria-label="Preview KPIs"
    >
      {stats.map(([label, value, note]) => (
        <article className={cn("border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#111827]", radius, note === "amber" ? "border-amber-200" : "border-black/10") } key={label}>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="font-mono text-2xl font-black tabular-nums">{value}</p>
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-black ring-1", note === "amber" ? "bg-amber-50 text-amber-800 ring-amber-100" : accent.muted)}>
              {note}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}

function ContentPreset({
  accent,
  compact,
  layout,
  preset,
  radius,
  rightRail
}: {
  accent: (typeof accentStyles)[Accent];
  compact: boolean;
  layout: ContentLayout;
  preset: MockPreset;
  radius: string;
  rightRail: RailMode;
}) {
  const baseCards = presetCards[preset];
  const testId = `layout-preset-${preset}`;

  if (layout === "single") {
    return (
      <section data-testid={testId}>
        <PanelStack accent={accent} cards={baseCards.slice(0, 4)} compact={compact} radius={radius} />
      </section>
    );
  }

  if (layout === "kpi") {
    return (
      <section className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]" data-testid={testId}>
        <PanelStack accent={accent} cards={baseCards.slice(0, 2)} compact={compact} radius={radius} />
        <DataTable accent={accent} compact={compact} radius={radius} />
      </section>
    );
  }

  if (layout === "split") {
    return (
      <section className="grid gap-3 lg:grid-cols-2" data-testid={testId}>
        <PanelStack accent={accent} cards={baseCards.slice(0, 3)} compact={compact} radius={radius} />
        <PanelStack accent={accent} cards={baseCards.slice(3, 6)} compact={compact} radius={radius} />
      </section>
    );
  }

  if (layout === "map-list") {
    return (
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]" data-testid={testId}>
        <MapCanvas accent={accent} radius={radius} />
        <PanelStack accent={accent} cards={baseCards.slice(0, 4)} compact={compact} radius={radius} />
      </section>
    );
  }

  if (layout === "timeline-inspector") {
    return (
      <section className={cn("grid gap-3", rightRail === "on" ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "xl:grid-cols-1")} data-testid={testId}>
        <TimelinePanel accent={accent} compact={compact} radius={radius} />
        {rightRail === "on" ? <Inspector accent={accent} radius={radius} /> : null}
      </section>
    );
  }

  return (
    <section className={cn("grid gap-3", rightRail === "on" ? "2xl:grid-cols-[320px_minmax(0,1fr)_340px]" : "xl:grid-cols-[320px_minmax(0,1fr)]")} data-testid={testId}>
      <PanelStack accent={accent} cards={baseCards.slice(0, 3)} compact={compact} radius={radius} />
      <MapCanvas accent={accent} radius={radius} />
      {rightRail === "on" ? <Inspector accent={accent} radius={radius} /> : null}
    </section>
  );
}

const presetCards: Record<MockPreset, Array<[string, string, string]>> = {
  "flight-monitor": [
    ["AAL 123", "Delayed 18m", "Gate 12 · Terminal 8"],
    ["DAL 440", "Boarding", "Gate B4 · On time"],
    ["UAL 89", "Aircraft swap", "Crew note pending"],
    ["Alert feed", "2 critical", "Route risk elevated"],
    ["Refresh job", "Healthy", "Last checked 22s ago"],
    ["Webhook", "Delivered", "PagerDuty clear"]
  ],
  "import-queue": [
    ["Gmail", "14 queued", "3 need review"],
    ["Forwarded email", "8 parsed", "1 low confidence"],
    ["Calendar", "Connected", "Sync due in 4m"],
    ["PDF import", "5 waiting", "OCR backlog stable"],
    ["Unfiled", "27 items", "Oldest 1h ago"],
    ["Automation", "Healthy", "Retry rate 3%"]
  ],
  "map-workspace": [
    ["Aircraft layer", "Live", "22s freshness"],
    ["Route overlay", "Enabled", "JFK to MIA"],
    ["Weather", "Moderate", "Thunderstorm cell"],
    ["Ground ops", "Clear", "No taxi alerts"],
    ["Companion list", "8 items", "Itinerary synced"],
    ["Position feed", "Healthy", "Cirium active"]
  ],
  overview: [
    ["Trips", "12 active", "4 depart today"],
    ["Alerts", "3 open", "1 critical"],
    ["Imports", "27 queued", "9 ready"],
    ["Flights", "18 live", "4 delayed"],
    ["Reports", "99.8%", "API success"],
    ["Itinerary", "42 plans", "6 unscheduled"]
  ],
  "trip-detail": [
    ["Miami Launch", "In transit", "JFK to MIA"],
    ["Hotel", "Confirmed", "Downtown Miami"],
    ["Flight", "Delayed", "AAL 123"],
    ["Meetings", "4 scheduled", "2 near hotel"],
    ["Documents", "7 attached", "All parsed"],
    ["Budget", "$2,400", "62% used"]
  ]
};

function PanelStack({
  accent,
  cards,
  compact,
  radius
}: {
  accent: (typeof accentStyles)[Accent];
  cards: Array<[string, string, string]>;
  compact: boolean;
  radius: string;
}) {
  return (
    <section className="grid gap-3" data-testid="layout-preview-card-stack" aria-label="Preview content cards">
      {cards.map(([title, value, note]) => (
        <PreviewCard key={title} radius={radius}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{title}</p>
              <p className={cn("mt-1 font-black", compact ? "text-lg" : "text-xl")}>{value}</p>
              <p className="mt-1 text-sm text-slate-500">{note}</p>
            </div>
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-black ring-1", accent.muted)}>live</span>
          </div>
        </PreviewCard>
      ))}
    </section>
  );
}

function MapCanvas({
  accent,
  radius
}: {
  accent: (typeof accentStyles)[Accent];
  radius: string;
}) {
  return (
    <section
      className={cn("relative min-h-[420px] overflow-hidden border bg-[#dbe8ee] dark:border-white/10 dark:bg-[#172033]", radius)}
      data-testid="layout-preview-map"
      aria-label="Map canvas preview"
    >
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="absolute left-[18%] top-[28%] h-2 w-2 rounded-full bg-slate-500" />
      <div className={cn("absolute left-[48%] top-[45%] h-4 w-4 rounded-full ring-4 ring-white/70", accent.bg)} />
      <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-black/10 bg-white/90 p-3 text-sm shadow-sm dark:border-white/10 dark:bg-[#111827]/90">
        <p className="font-black">AAL 123 position feed</p>
        <p className="mt-1 text-slate-500">Bearing 101 · 436 kt · refreshed 22 seconds ago</p>
      </div>
    </section>
  );
}

function TimelinePanel({
  accent,
  compact,
  radius
}: {
  accent: (typeof accentStyles)[Accent];
  compact: boolean;
  radius: string;
}) {
  const events = ["Hotel check-in", "AAL 123 arrival", "Crew sync", "Dinner reservation"];

  return (
    <section
      className={cn("border bg-white p-4 dark:border-white/10 dark:bg-[#111827]", radius)}
      data-testid="layout-preview-timeline"
      aria-label="Itinerary preview"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black">Operational itinerary</h3>
        <span className={cn("rounded-full px-2 py-1 text-[11px] font-black ring-1", accent.muted)}>synced</span>
      </div>
      <div className="mt-4 grid gap-3">
        {events.map((event, index) => (
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3" key={event}>
            <p className="font-mono text-xs text-slate-500 tabular-nums">{`${10 + index}:00`}</p>
            <div className={cn("border-l-2 pl-3", accent.border)}>
              <p className={cn("font-black", compact ? "text-sm" : "text-base")}>{event}</p>
              <p className="text-sm text-slate-500">Status confirmed · owner assigned</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Inspector({
  accent,
  radius
}: {
  accent: (typeof accentStyles)[Accent];
  radius: string;
}) {
  return (
    <aside
      className={cn("border bg-white p-4 dark:border-white/10 dark:bg-[#111827]", radius)}
      data-testid="layout-preview-right-rail"
      aria-label="Selected flight detail"
    >
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Inspector</p>
      <h3 className="mt-2 text-xl font-black">AAL 123</h3>
      <div className="mt-4 grid gap-3 text-sm">
        {[
          ["Status", "Delayed"],
          ["Gate", "12"],
          ["Terminal", "8"],
          ["Route", "JFK to MIA"],
          ["Owner", "Flight Ops"]
        ].map(([label, value]) => (
          <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-2 dark:border-white/10" key={label}>
            <span className="text-slate-500">{label}</span>
            <span className={cn("font-black", label === "Status" && accent.text)}>{value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function DataTable({
  accent,
  compact,
  radius
}: {
  accent: (typeof accentStyles)[Accent];
  compact: boolean;
  radius: string;
}) {
  const rows = [
    ["AAL 123", "Delayed", "MIA", "18m"],
    ["DAL 440", "Boarding", "ATL", "0m"],
    ["UAL 89", "Review", "SFO", "7m"]
  ];

  return (
    <section
      className={cn("overflow-hidden border bg-white dark:border-white/10 dark:bg-[#111827]", radius)}
      data-testid="layout-preview-table"
      aria-label="Flight table preview"
    >
      <div className="border-b border-black/10 p-3 dark:border-white/10">
        <h3 className="font-black">Active flight table</h3>
      </div>
      <table className={cn("w-full text-left", compact ? "text-xs" : "text-sm")}>
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500 dark:bg-white/5">
          <tr>
            {["Flight", "State", "Arrival", "Variance"].map((head) => (
              <th className="px-3 py-2" key={head}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10 dark:divide-white/10">
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) => (
                <td className={cn("px-3 py-3", index === 1 && cell !== "Boarding" && accent.text, index === 0 && "font-black")} key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PreviewStates({
  accent,
  radius
}: {
  accent: (typeof accentStyles)[Accent];
  radius: string;
}) {
  return (
    <section
      className="grid gap-3 md:grid-cols-3"
      data-testid="layout-preview-states"
      aria-label="Preview resilience states"
    >
      <StateCard radius={radius} title="Loading" value="Refreshing flight markers..." />
      <StateCard radius={radius} title="Empty" value="No alerts match current filters." />
      <StateCard radius={radius} title="Error" value="Panel failed; shell stayed active." accent={accent.text} />
    </section>
  );
}

function StateCard({
  accent,
  radius,
  title,
  value
}: {
  accent?: string;
  radius: string;
  title: string;
  value: string;
}) {
  return (
    <PreviewCard radius={radius}>
      <p className={cn("text-xs font-black uppercase tracking-[0.12em] text-slate-500", accent)}>{title}</p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{value}</p>
    </PreviewCard>
  );
}

function PreviewCard({ children, radius }: { children: ReactNode; radius: string }) {
  return (
    <article className={cn("border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#111827]", radius)}>
      {children}
    </article>
  );
}
