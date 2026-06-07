"use client";

import { RecoverableRouteError } from "@/components/recoverable-route-error";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RecoverableRouteError error={error} reset={reset} title="Could not load trips" />;
}
