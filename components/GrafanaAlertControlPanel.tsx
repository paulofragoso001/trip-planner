"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  defaultGrafanaAlertDrafts,
  draftToGrafanaPayload,
  type GrafanaAlertDraft,
  type GrafanaRuleAuditRecord
} from "@/lib/grafana-alert-rules";
import { useAuthedGrafanaFetch } from "@/hooks/useAuthedGrafanaFetch";

type GrafanaRulesResponse = {
  auditTrail?: GrafanaRuleAuditRecord[];
  configured: boolean;
  message?: string;
  rules: GrafanaAlertDraft[];
  source: "defaults" | "grafana";
};

const stateOptions = {
  execErrState: ["Error", "Alerting", "OK"] as const,
  noDataState: ["NoData", "OK", "Alerting"] as const
};

export function GrafanaAlertControlPanel() {
  const authedFetch = useAuthedGrafanaFetch();
  const [rules, setRules] = useState<GrafanaAlertDraft[]>(defaultGrafanaAlertDrafts);
  const [auditTrail, setAuditTrail] = useState<GrafanaRuleAuditRecord[]>([]);
  const [configured, setConfigured] = useState(false);
  const [selectedId, setSelectedId] = useState(defaultGrafanaAlertDrafts[0]?.title ?? "");
  const [status, setStatus] = useState("Loading Grafana alert rules...");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<unknown>(null);

  useEffect(() => {
    let active = true;

    async function loadRules() {
      try {
        const response = await authedFetch("/api/grafana/alert-rules", { cache: "no-store" });
        const payload = (await response.json()) as GrafanaRulesResponse;

        if (!response.ok) {
          throw new Error("Could not load Grafana alert rules.");
        }

        if (!active) return;
        setRules(payload.rules.length ? payload.rules : defaultGrafanaAlertDrafts);
        setSelectedId((payload.rules[0]?.uid || payload.rules[0]?.title) ?? defaultGrafanaAlertDrafts[0]?.title ?? "");
        setAuditTrail(payload.auditTrail ?? []);
        setConfigured(payload.configured);
        setStatus(payload.configured ? "Loaded Grafana-managed alert rules." : payload.message ?? "Grafana is not configured.");
      } catch (error) {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "Could not load Grafana alert rules.");
      }
    }

    void loadRules();
    return () => {
      active = false;
    };
  }, [authedFetch]);

  const selectedRule = rules.find((rule) => ruleKey(rule) === selectedId) ?? rules[0] ?? null;

  function updateRule(key: string, patch: Partial<GrafanaAlertDraft>) {
    setRules((current) =>
      current.map((rule) =>
        ruleKey(rule) === key
          ? {
              ...rule,
              ...patch,
              annotations: patch.annotations ? { ...rule.annotations, ...patch.annotations } : rule.annotations,
              labels: patch.labels ? { ...rule.labels, ...patch.labels } : rule.labels
            }
          : rule
      )
    );
  }

  function addRule() {
    const nextRule: GrafanaAlertDraft = {
      ...defaultGrafanaAlertDrafts[0],
      annotations: { ...defaultGrafanaAlertDrafts[0].annotations },
      labels: { ...defaultGrafanaAlertDrafts[0].labels },
      title: `New flight alert ${rules.length + 1}`,
      uid: undefined
    };
    setRules((current) => [nextRule, ...current]);
    setSelectedId(ruleKey(nextRule));
  }

  async function writeRule(action: "delete" | "dry-run" | "save", rule: GrafanaAlertDraft) {
    setSaving(true);
    setErrors([]);

    try {
      const response = await authedFetch("/api/grafana/alert-rules", {
        body: JSON.stringify({
          action,
          rule,
          user: "operator"
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        setErrors(Array.isArray(payload.errors) ? payload.errors : [payload.error || "Grafana write failed."]);
        setStatus("Grafana rule write rejected.");
        return;
      }

      setPreview(payload.grafanaPayload ?? payload.grafana ?? payload);
      if (payload.auditRecord) {
        setAuditTrail((current) => [payload.auditRecord, ...current].slice(0, 12));
      }
      if (action === "delete") {
        setRules((current) => current.filter((item) => ruleKey(item) !== ruleKey(rule)));
      }
      setStatus(action === "dry-run" ? "Dry-run payload generated." : "Grafana provisioning API accepted the change.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not write Grafana rule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4" data-testid="grafana-alert-control-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Grafana alert control panel</h2>
          <p className="text-sm text-slate-400">
            Grafana-managed alert editor backed by the Alerting Provisioning HTTP API.
          </p>
        </div>
        <button
          className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-200 hover:border-blue-400"
          data-testid="grafana-new-rule"
          onClick={addRule}
          type="button"
        >
          New rule
        </button>
      </div>

      <div className={configured ? "mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" : "mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"}>
        {saving ? "Writing to Grafana..." : status}
      </div>

      {errors.length ? (
        <div className="mt-3 grid gap-2">
          {errors.map((error) => (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" key={error}>
              {error}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-[280px_1fr]">
        <div className="grid content-start gap-2">
          {rules.map((rule) => {
            const active = ruleKey(rule) === ruleKey(selectedRule ?? rule);
            return (
              <button
                className={`rounded-xl border px-3 py-2 text-left text-sm ${active ? "border-blue-500 bg-blue-500/10 text-blue-100" : "border-slate-800 bg-slate-950 text-slate-300"}`}
                key={ruleKey(rule)}
                onClick={() => setSelectedId(ruleKey(rule))}
                type="button"
              >
                <div className="font-bold">{rule.title}</div>
                <div className="mt-1 text-xs opacity-75">{rule.folderUid} / {rule.ruleGroup}</div>
              </button>
            );
          })}
        </div>

        {selectedRule ? (
          <GrafanaRuleEditor
            onDelete={() => void writeRule("delete", selectedRule)}
            onDryRun={() => void writeRule("dry-run", selectedRule)}
            onSave={() => void writeRule("save", selectedRule)}
            onUpdate={(patch) => updateRule(ruleKey(selectedRule), patch)}
            rule={selectedRule}
            saving={saving}
          />
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            No Grafana rules loaded.
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Dry-run / save payload
          </div>
          <pre className="mt-2 max-h-72 overflow-auto text-xs leading-5 text-slate-300">
            {JSON.stringify(preview ?? (selectedRule ? draftToGrafanaPayload(selectedRule, "prometheus") : null), null, 2)}
          </pre>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Provisioning audit
          </div>
          <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto text-xs text-slate-300">
            {auditTrail.length ? (
              auditTrail.map((record) => (
                <div className="rounded-lg border border-slate-800 px-2 py-1" key={record.id}>
                  <span className="font-bold">{record.action}</span> {record.title}
                  <span className="text-slate-500"> by {record.user} at {formatShortTime(record.timestamp)}</span>
                </div>
              ))
            ) : (
              <div className="text-slate-500">No Grafana provisioning writes yet.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function GrafanaRuleEditor({
  onDelete,
  onDryRun,
  onSave,
  onUpdate,
  rule,
  saving
}: {
  onDelete: () => void;
  onDryRun: () => void;
  onSave: () => void;
  onUpdate: (patch: Partial<GrafanaAlertDraft>) => void;
  rule: GrafanaAlertDraft;
  saving: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Rule title">
          <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" onChange={(event) => onUpdate({ title: event.target.value })} value={rule.title} />
        </Field>
        <Field label="UID">
          <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" onChange={(event) => onUpdate({ uid: event.target.value || undefined })} placeholder="New rule" value={rule.uid ?? ""} />
        </Field>
        <Field label="Folder UID">
          <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" onChange={(event) => onUpdate({ folderUid: event.target.value })} value={rule.folderUid} />
        </Field>
        <Field label="Rule group">
          <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" onChange={(event) => onUpdate({ ruleGroup: event.target.value })} value={rule.ruleGroup} />
        </Field>
        <Field label="Evaluation window">
          <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" onChange={(event) => onUpdate({ for: event.target.value })} value={rule.for} />
        </Field>
        <Field label="Enabled">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input checked={rule.enabled} className="h-4 w-4 accent-blue-500" onChange={(event) => onUpdate({ enabled: event.target.checked })} type="checkbox" />
            Active in Grafana
          </label>
        </Field>
        <Field label="No data state">
          <select className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" onChange={(event) => onUpdate({ noDataState: event.target.value as GrafanaAlertDraft["noDataState"] })} value={rule.noDataState}>
            {stateOptions.noDataState.map((state) => <option key={state}>{state}</option>)}
          </select>
        </Field>
        <Field label="Execution error state">
          <select className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" onChange={(event) => onUpdate({ execErrState: event.target.value as GrafanaAlertDraft["execErrState"] })} value={rule.execErrState}>
            {stateOptions.execErrState.map((state) => <option key={state}>{state}</option>)}
          </select>
        </Field>
      </div>

      <Field className="mt-3" label="Query expression">
        <textarea className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100" onChange={(event) => onUpdate({ expr: event.target.value })} value={rule.expr} />
      </Field>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Labels and routing</div>
          <LabelInput label="team" onChange={(value) => onUpdate({ labels: { team: value } })} value={rule.labels.team ?? ""} />
          <LabelInput label="queue" onChange={(value) => onUpdate({ labels: { queue: value } })} value={rule.labels.queue ?? ""} />
          <LabelInput label="severity" onChange={(value) => onUpdate({ labels: { severity: value } })} value={rule.labels.severity ?? ""} />
          <LabelInput label="contact_point" onChange={(value) => onUpdate({ labels: { contact_point: value } })} value={rule.labels.contact_point ?? ""} />
        </div>
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Annotations</div>
          <LabelInput label="summary" onChange={(value) => onUpdate({ annotations: { summary: value } })} value={rule.annotations.summary ?? ""} wide />
          <label className="mt-2 grid gap-1 text-xs text-slate-500">
            description
            <textarea className="min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" onChange={(event) => onUpdate({ annotations: { description: event.target.value } })} value={rule.annotations.description ?? ""} />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-200 hover:border-blue-400 disabled:opacity-60" data-testid="grafana-dry-run" disabled={saving} onClick={onDryRun} type="button">Dry run</button>
        <button className="rounded-full border border-blue-500 bg-blue-500 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-blue-400 disabled:opacity-60" data-testid="grafana-save-rule" disabled={saving} onClick={onSave} type="button">{rule.uid ? "Update in Grafana" : "Create in Grafana"}</button>
        <button className="rounded-full border border-rose-500 bg-rose-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-rose-100 hover:bg-rose-500/20 disabled:opacity-60" disabled={saving || !rule.uid} onClick={onDelete} type="button">Delete</button>
      </div>
    </div>
  );
}

function Field({
  children,
  className = "",
  label
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`grid gap-1 text-xs text-slate-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function LabelInput({
  label,
  onChange,
  value,
  wide = false
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
  wide?: boolean;
}) {
  return (
    <label className="mt-2 grid gap-1 text-xs text-slate-500">
      {label}
      <input className={wide ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" : "w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"} onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function ruleKey(rule: GrafanaAlertDraft) {
  return rule.uid || rule.title;
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}
