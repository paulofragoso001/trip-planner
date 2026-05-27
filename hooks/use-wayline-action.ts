"use client";

import { useMemo, useState, useTransition } from "react";

export type ActionStatus = "idle" | "loading" | "success" | "error" | "timeout";

export type ActionState<T = unknown> = {
  data: T | null;
  error: string | null;
  message: string;
  status: ActionStatus;
};

export type ActionInput = {
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  timeoutMs?: number;
  url: string;
};

function createInitialState<T>(): ActionState<T> {
  return {
    data: null,
    error: null,
    message: "",
    status: "idle"
  };
}

export function useWaylineAction<T = unknown>() {
  const [state, setState] = useState<ActionState<T>>(() => createInitialState<T>());
  const [isTransitionPending, startTransition] = useTransition();

  const run = useMemo(() => {
    return async ({ body, method = "POST", timeoutMs = 15000, url }: ActionInput) => {
      setState({
        data: null,
        error: null,
        message: "Working...",
        status: "loading"
      });

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          body: body === undefined ? undefined : JSON.stringify(body),
          headers:
            body === undefined
              ? { Accept: "application/json" }
              : {
                  Accept: "application/json",
                  "Content-Type": "application/json"
                },
          method,
          signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = normalizeErrorMessage(payload, response.status);
          const next = {
            data: null,
            error: message,
            message,
            status: "error" as const
          };

          setState(next);
          return next;
        }

        const next = {
          data: (readData(payload) ?? payload) as T,
          error: null,
          message: readMessage(payload) ?? "Done.",
          status: "success" as const
        };

        setState(next);
        return next;
      } catch (error) {
        const timedOut = error instanceof DOMException && error.name === "AbortError";
        const message = timedOut
          ? "Timed out. Try again."
          : error instanceof Error
            ? error.message
            : "Something went wrong.";
        const next = {
          data: null,
          error: message,
          message,
          status: timedOut ? ("timeout" as const) : ("error" as const)
        };

        setState(next);
        return next;
      } finally {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const reset = () => setState(createInitialState<T>());

  return {
    isPending: isTransitionPending || state.status === "loading",
    reset,
    run,
    startTransition,
    state
  };
}

function normalizeErrorMessage(payload: unknown, status: number) {
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

function readData(payload: unknown) {
  return isRecord(payload) && "data" in payload ? payload.data : null;
}

function readMessage(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (isRecord(payload.data)) {
    if (typeof payload.data.message === "string") {
      return payload.data.message;
    }

    for (const value of Object.values(payload.data)) {
      if (isRecord(value) && typeof value.message === "string") {
        return value.message;
      }
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
