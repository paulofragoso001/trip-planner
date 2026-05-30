"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

type CalendarProvider = "google" | "outlook";
type ConnectionMessageTone = "error" | "info" | "success";

type CalendarConnection = {
  default_calendar_id: string | null;
  default_calendar_name: string | null;
  id: string;
  last_error: string | null;
  last_synced_at: string | null;
  provider: CalendarProvider;
  provider_account_email: string | null;
  provider_account_name: string | null;
  status: "active" | "error" | "needs_reauth" | "revoked";
};

type ConnectionsResponse = {
  connections?: CalendarConnection[];
};

const providers = [
  {
    label: "Google Calendar",
    provider: "google" as const,
    shortLabel: "Google"
  },
  {
    label: "Outlook Calendar",
    provider: "outlook" as const,
    shortLabel: "Outlook"
  }
];

export function CalendarSyncPanel({ tripId }: { tripId: string }) {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [connectionMessageTone, setConnectionMessageTone] =
    useState<ConnectionMessageTone>("info");
  const [connectProvider, setConnectProvider] = useState<CalendarProvider | null>(null);
  const [disconnectProvider, setDisconnectProvider] = useState<CalendarProvider | null>(null);
  const { isPending: syncPending, run: runSync, state: syncState } =
    useWaylineAction();

  const connectionByProvider = useMemo(() => {
    return new Map(connections.map((connection) => [connection.provider, connection]));
  }, [connections]);

  const refreshConnections = useCallback(async () => {
    setLoadingConnections(true);

    try {
      const payload = await fetchCanonical<ConnectionsResponse>(
        "/api/calendar/connections",
        { method: "GET" }
      );

      setConnections(payload.connections || []);
      if (!readOAuthConnectionResult()) {
        setConnectionMessage("");
      }
    } catch (error) {
      setConnectionMessage(readErrorMessage(error));
      setConnectionMessageTone("error");
    } finally {
      setLoadingConnections(false);
    }
  }, []);

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  useEffect(() => {
    const result = readOAuthConnectionResult();

    if (!result) {
      return;
    }

    void refreshConnections().then(() => {
      setConnectionMessage(`${providerLabel(result.provider)} Calendar connected.`);
      setConnectionMessageTone("success");
    });
  }, [refreshConnections]);

  async function connect(provider: CalendarProvider) {
    setConnectProvider(provider);
    setConnectionMessage("");
    setConnectionMessageTone("info");

    try {
      const redirect = encodeURIComponent(getCleanRedirectPath());
      const payload = await fetchCanonical<{
        authUrl: string | null;
        configured: boolean;
        message?: string;
        requiredEnv?: string[];
      }>(`/api/calendar/oauth/${provider}?redirect=${redirect}`, {
        allowCanonicalError: true,
        method: "GET"
      });

      if (payload.authUrl) {
        window.location.href = payload.authUrl;
        return;
      }

      setConnectionMessage(formatOAuthConfigMessage(provider, payload));
      setConnectionMessageTone("error");
    } catch (error) {
      setConnectionMessage(readErrorMessage(error));
      setConnectionMessageTone("error");
    } finally {
      setConnectProvider(null);
    }
  }

  async function disconnect(provider: CalendarProvider) {
    setDisconnectProvider(provider);
    setConnectionMessage("");

    try {
      await fetchCanonical("/api/calendar/connections", {
        body: { provider },
        method: "DELETE"
      });
      await refreshConnections();
      setConnectionMessage(
        `${providerLabel(provider)} Calendar disconnected.`
      );
      setConnectionMessageTone("info");
    } catch (error) {
      setConnectionMessage(readErrorMessage(error));
      setConnectionMessageTone("error");
    } finally {
      setDisconnectProvider(null);
    }
  }

  async function sync(provider: CalendarProvider) {
    const connection = connectionByProvider.get(provider);

    await runSync({
      body: {
        calendarId: connection?.default_calendar_id || "primary",
        provider,
        tripId
      },
      method: "POST",
      timeoutMs: 15000,
      url: "/api/calendar/sync"
    });

    await refreshConnections();
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-black">Calendar sync</h3>
          <p className="mt-1 text-sm text-slate-600">
            Send timed places to Google Calendar or Outlook.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          One-way
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {providers.map(({ label, provider, shortLabel }) => {
          const connection = connectionByProvider.get(provider);
          const connected = connection?.status === "active";
          const actionPending =
            syncPending || connectProvider === provider || disconnectProvider === provider;

          return (
            <article
              className="rounded-2xl border border-slate-200 p-3"
              key={provider}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{label}</p>
                    <span className={statusClass(connection?.status)}>
                      {statusLabel(connection?.status, loadingConnections)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {connection?.provider_account_email ||
                      connection?.provider_account_name ||
                      (connected ? "Connected account" : "No account connected")}
                  </p>
                  {connection?.last_error ? (
                    <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                      {connection.last_error}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={actionPending}
                    onClick={() => connect(provider)}
                    type="button"
                  >
                    {connectProvider === provider
                      ? "Opening..."
                      : connected
                        ? "Reconnect"
                        : `Connect ${shortLabel}`}
                  </button>
                  <button
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={actionPending || !connected}
                    onClick={() => sync(provider)}
                    type="button"
                  >
                    {syncPending ? "Syncing..." : "Sync trip"}
                  </button>
                  {connected ? (
                    <button
                      className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={actionPending}
                      onClick={() => disconnect(provider)}
                      type="button"
                    >
                      {disconnectProvider === provider ? "Disconnecting..." : "Disconnect"}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {syncState.status !== "idle" && syncState.message ? (
        <p
          aria-live="polite"
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            syncState.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : syncState.status === "error" || syncState.status === "timeout"
                ? "bg-red-50 text-red-700"
                : "bg-slate-50 text-slate-700"
          }`}
        >
          {syncState.message}
        </p>
      ) : null}

      {connectionMessage ? (
        <p
          aria-live="polite"
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${connectionMessageClass(
            connectionMessageTone
          )}`}
        >
          {connectionMessage}
        </p>
      ) : null}
    </section>
  );
}

function normalizeProvider(value: string | null): CalendarProvider | null {
  return value === "google" || value === "outlook" ? value : null;
}

function readOAuthConnectionResult() {
  const params = new URLSearchParams(window.location.search);
  const provider = normalizeProvider(params.get("calendarProvider"));

  if (params.get("calendarStatus") !== "connected" || !provider) {
    return null;
  }

  return { provider };
}

function providerLabel(provider: CalendarProvider) {
  return provider === "google" ? "Google" : "Outlook";
}

function getCleanRedirectPath() {
  const url = new URL(window.location.href);

  url.searchParams.delete("calendarProvider");
  url.searchParams.delete("calendarStatus");

  const search = url.searchParams.toString();

  return `${url.pathname}${search ? `?${search}` : ""}`;
}

function connectionMessageClass(tone: ConnectionMessageTone) {
  if (tone === "success") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (tone === "error") {
    return "bg-red-50 text-red-700";
  }

  return "bg-amber-50 text-amber-800";
}

function statusLabel(status: CalendarConnection["status"] | undefined, loading: boolean) {
  if (loading) {
    return "Checking";
  }

  if (status === "active") {
    return "Connected";
  }

  if (status === "needs_reauth") {
    return "Needs reauth";
  }

  if (status === "error") {
    return "Error";
  }

  if (status === "revoked") {
    return "Disconnected";
  }

  return "Not connected";
}

function statusClass(status: CalendarConnection["status"] | undefined) {
  const base = "rounded-full px-2.5 py-1 text-xs font-bold";

  if (status === "active") {
    return `${base} bg-emerald-50 text-emerald-700`;
  }

  if (status === "needs_reauth" || status === "error") {
    return `${base} bg-red-50 text-red-700`;
  }

  return `${base} bg-slate-100 text-slate-600`;
}

async function fetchCanonical<TData = Record<string, unknown>>(
  url: string,
  options: {
    allowCanonicalError?: boolean;
    body?: unknown;
    method: "DELETE" | "GET" | "POST";
  }
): Promise<TData> {
  const response = await fetch(url, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers:
      options.body === undefined
        ? { Accept: "application/json" }
        : {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
    method: options.method
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok && !options.allowCanonicalError) {
    throw new Error(normalizeApiMessage(payload, response.status));
  }

  if (isRecord(payload) && isRecord(payload.error)) {
    throw new Error(normalizeApiMessage(payload, response.status));
  }

  if (isRecord(payload) && isRecord(payload.data)) {
    return payload.data as TData;
  }

  return payload as TData;
}

function normalizeApiMessage(payload: unknown, status: number) {
  if (isRecord(payload)) {
    if (typeof payload.error === "string") {
      return payload.error;
    }

    if (isRecord(payload.error) && typeof payload.error.message === "string") {
      return payload.error.message;
    }

    if (typeof payload.message === "string") {
      return payload.message;
    }
  }

  return `Request failed (${status})`;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatOAuthConfigMessage(
  provider: CalendarProvider,
  payload: { message?: string; requiredEnv?: string[] }
) {
  const fallback = `${provider === "google" ? "Google" : "Outlook"} Calendar OAuth is not configured.`;
  const requiredEnv = payload.requiredEnv?.filter(Boolean) || [];

  if (!requiredEnv.length) {
    return payload.message || fallback;
  }

  return `${payload.message || fallback} Missing server env: ${requiredEnv.join(", ")}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
