"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportPanelError } from "@/lib/panel-error-reporting";

type PanelErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle: string;
};

type PanelErrorBoundaryState = {
  error: Error | null;
};

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportPanelError({
      componentStack: info.componentStack || undefined,
      digest: "digest" in error && typeof error.digest === "string" ? error.digest : undefined,
      message: error.message,
      name: error.name,
      panelName: this.props.fallbackTitle,
      source: "boundary",
      stack: error.stack
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {this.props.fallbackTitle} is temporarily unavailable. The rest of the dashboard is still ready.
        </div>
      );
    }

    return this.props.children;
  }
}
