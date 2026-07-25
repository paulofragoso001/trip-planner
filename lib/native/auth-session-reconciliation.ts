import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export type NativeSessionIdentity = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export function sessionIdentity(session: Session | null): NativeSessionIdentity | null {
  if (!session?.access_token || !session.refresh_token || !session.expires_at) return null;
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at
  };
}

export function sessionsLogicallyEqual(
  left: NativeSessionIdentity | null,
  right: NativeSessionIdentity | null
) {
  if (!left || !right) return left === right;
  return left.accessToken === right.accessToken
    && left.refreshToken === right.refreshToken
    && left.expiresAt === right.expiresAt;
}

export function nativeEventForAuthChange(event: AuthChangeEvent) {
  if (event === "SIGNED_OUT") return "SIGNED_OUT" as const;
  if (event === "TOKEN_REFRESHED") return "TOKEN_REFRESHED" as const;
  return "SIGNED_IN" as const;
}

export function shouldForwardWebAuthEvent(
  event: AuthChangeEvent,
  identity: NativeSessionIdentity | null,
  lastNativeIdentity: NativeSessionIdentity | null
) {
  if (event === "SIGNED_OUT") return true;
  if (!identity) return false;
  if (event === "USER_UPDATED") {
    return !sessionsLogicallyEqual(identity, lastNativeIdentity);
  }
  if (
    event === "INITIAL_SESSION"
    || event === "SIGNED_IN"
    || event === "TOKEN_REFRESHED"
    || event === "PASSWORD_RECOVERY"
  ) {
    return !sessionsLogicallyEqual(identity, lastNativeIdentity);
  }
  return false;
}

export type ReservedWebAuthEvent = {
  event: AuthChangeEvent;
  identity: NativeSessionIdentity | null;
  revisionId: number;
};

export class NativeAuthEchoGuard {
  private lastNativeIdentity: NativeSessionIdentity | null = null;
  private lastSessionSentToNative: NativeSessionIdentity | null = null;
  private pendingNativeApplication: NativeSessionIdentity | null = null;
  private lastExplicitSignOutWasSent = false;
  private latestWebRevision = 0;

  observeNative(identity: NativeSessionIdentity | null) {
    this.lastNativeIdentity = identity;
    this.lastSessionSentToNative = identity;
    if (identity) this.lastExplicitSignOutWasSent = false;
  }

  recordWebImport(identity: NativeSessionIdentity | null) {
    this.lastNativeIdentity = identity;
    this.lastSessionSentToNative = identity;
    if (identity) this.lastExplicitSignOutWasSent = false;
  }

  shouldApplyNative(
    currentWebIdentity: NativeSessionIdentity | null,
    nativeIdentity: NativeSessionIdentity | null
  ) {
    return !sessionsLogicallyEqual(currentWebIdentity, nativeIdentity);
  }

  beginNativeApplication(identity: NativeSessionIdentity) {
    this.pendingNativeApplication = identity;
  }

  cancelNativeApplication() {
    this.pendingNativeApplication = null;
  }

  consumeExpectedWebEcho(event: AuthChangeEvent, identity: NativeSessionIdentity | null) {
    if (!this.pendingNativeApplication) return false;
    if (
      event !== "INITIAL_SESSION"
      && event !== "SIGNED_IN"
      && event !== "TOKEN_REFRESHED"
      && event !== "USER_UPDATED"
    ) {
      this.pendingNativeApplication = null;
      return false;
    }
    if (!sessionsLogicallyEqual(identity, this.pendingNativeApplication)) {
      this.pendingNativeApplication = null;
      return false;
    }
    this.pendingNativeApplication = null;
    this.lastNativeIdentity = identity;
    this.lastSessionSentToNative = identity;
    this.lastExplicitSignOutWasSent = false;
    return true;
  }

  shouldForwardWeb(event: AuthChangeEvent, identity: NativeSessionIdentity | null) {
    if (event === "SIGNED_OUT") return !this.lastExplicitSignOutWasSent;
    return shouldForwardWebAuthEvent(event, identity, this.lastSessionSentToNative);
  }

  reserveWebForward(
    event: AuthChangeEvent,
    identity: NativeSessionIdentity | null,
    createRevision: () => number
  ): ReservedWebAuthEvent | null {
    if (!this.shouldForwardWeb(event, identity)) return null;

    const candidateRevision = Math.trunc(createRevision());
    const revisionId = Math.max(candidateRevision, this.latestWebRevision + 1);
    this.latestWebRevision = revisionId;

    if (event === "SIGNED_OUT") {
      this.lastExplicitSignOutWasSent = true;
      this.lastSessionSentToNative = null;
    } else {
      this.lastExplicitSignOutWasSent = false;
      this.lastSessionSentToNative = identity;
    }

    return { event, identity, revisionId };
  }

  releaseWebForward(reservation: ReservedWebAuthEvent) {
    if (reservation.revisionId !== this.latestWebRevision) return;
    if (reservation.event === "SIGNED_OUT") {
      this.lastExplicitSignOutWasSent = false;
      return;
    }
    if (sessionsLogicallyEqual(this.lastSessionSentToNative, reservation.identity)) {
      this.lastSessionSentToNative = this.lastNativeIdentity;
    }
  }
}
