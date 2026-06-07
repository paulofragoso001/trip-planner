"use client";

import { RecoverableRouteError } from "@/components/recoverable-route-error";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RecoverableRouteError error={error} reset={reset} title="This panel could not load" />;
}
