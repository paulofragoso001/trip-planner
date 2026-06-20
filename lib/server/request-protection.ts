import "server-only";

import { NextResponse } from "next/server";
import { isAllowedSessionMutationRequest } from "@/lib/request-protection-core";
import { allowsDashboardTestBypass } from "@/lib/server/auth-flags";

export function validateSessionMutationRequest(request: Request) {
  if (
    isAllowedSessionMutationRequest(request, {
      allowTestBypass: allowsDashboardTestBypass()
    })
  ) {
    return null;
  }

  return NextResponse.json(
    { error: "Cross-site mutation request blocked." },
    { status: 403 }
  );
}
