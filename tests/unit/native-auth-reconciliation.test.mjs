import assert from "node:assert/strict";
import test from "node:test";
import {
  NativeAuthEchoGuard,
  sessionsLogicallyEqual,
  shouldForwardWebAuthEvent
} from "../../lib/native/auth-session-reconciliation.ts";

const sessionA = {
  accessToken: "dummy-access-a",
  refreshToken: "dummy-refresh-a",
  expiresAt: 1_900_000_000
};
const sessionB = {
  accessToken: "dummy-access-b",
  refreshToken: "dummy-refresh-b",
  expiresAt: 1_900_000_100
};

test("logical equality compares access token, refresh token, and expiry", () => {
  assert.equal(sessionsLogicallyEqual(sessionA, { ...sessionA }), true);
  assert.equal(sessionsLogicallyEqual(sessionA, { ...sessionA, accessToken: "changed" }), false);
  assert.equal(sessionsLogicallyEqual(sessionA, { ...sessionA, refreshToken: "changed" }), false);
  assert.equal(sessionsLogicallyEqual(sessionA, { ...sessionA, expiresAt: sessionA.expiresAt + 1 }), false);
});

test("matching native event does not require Web setSession", () => {
  const guard = new NativeAuthEchoGuard();
  guard.observeNative(sessionA);
  assert.equal(guard.shouldApplyNative(sessionA, sessionA), false);
});

test("changed native session and missing Web session apply once", () => {
  const guard = new NativeAuthEchoGuard();
  guard.observeNative(sessionB);
  assert.equal(guard.shouldApplyNative(sessionA, sessionB), true);
  assert.equal(guard.shouldApplyNative(null, sessionB), true);
});

test("expected SIGNED_IN echo from native setSession is consumed", () => {
  const guard = new NativeAuthEchoGuard();
  guard.beginNativeApplication(sessionA);
  assert.equal(guard.consumeExpectedWebEcho("SIGNED_IN", sessionA), true);
  assert.equal(guard.shouldForwardWeb("SIGNED_IN", sessionA), false);
});

test("changed TOKEN_REFRESHED credentials are forwarded", () => {
  assert.equal(shouldForwardWebAuthEvent("TOKEN_REFRESHED", sessionB, sessionA), true);
  assert.equal(shouldForwardWebAuthEvent("TOKEN_REFRESHED", sessionA, sessionA), false);
});

test("USER_UPDATED and INITIAL_SESSION ignore unchanged credentials", () => {
  assert.equal(shouldForwardWebAuthEvent("USER_UPDATED", sessionA, sessionA), false);
  assert.equal(shouldForwardWebAuthEvent("INITIAL_SESSION", sessionA, sessionA), false);
  assert.equal(shouldForwardWebAuthEvent("USER_UPDATED", sessionB, sessionA), true);
});

test("SIGNED_OUT always propagates", () => {
  assert.equal(shouldForwardWebAuthEvent("SIGNED_OUT", null, sessionA), true);
});

test("repeated identical SIGNED_IN events reserve one native call", () => {
  const guard = new NativeAuthEchoGuard();
  const first = guard.reserveWebForward("SIGNED_IN", sessionA, () => 100);
  const duplicate = guard.reserveWebForward("SIGNED_IN", sessionA, () => 101);
  assert.equal(first?.revisionId, 100);
  assert.equal(duplicate, null);
});

test("repeated INITIAL_SESSION and SIGNED_IN callbacks share one logical import", () => {
  const guard = new NativeAuthEchoGuard();
  assert.equal(guard.reserveWebForward("INITIAL_SESSION", sessionA, () => 200)?.revisionId, 200);
  assert.equal(guard.reserveWebForward("INITIAL_SESSION", sessionA, () => 201), null);
  assert.equal(guard.reserveWebForward("SIGNED_IN", sessionA, () => 202), null);
});

test("unchanged USER_UPDATED and PASSWORD_RECOVERY events do not resync", () => {
  const guard = new NativeAuthEchoGuard();
  guard.reserveWebForward("SIGNED_IN", sessionA, () => 300);
  assert.equal(guard.reserveWebForward("USER_UPDATED", sessionA, () => 301), null);
  assert.equal(guard.reserveWebForward("PASSWORD_RECOVERY", sessionA, () => 302), null);
});

test("changed TOKEN_REFRESHED fields each create one transition", () => {
  const guard = new NativeAuthEchoGuard();
  guard.reserveWebForward("SIGNED_IN", sessionA, () => 400);
  const accessRotation = { ...sessionA, accessToken: "dummy-access-rotated" };
  const refreshRotation = { ...accessRotation, refreshToken: "dummy-refresh-rotated" };
  const expiryRotation = { ...refreshRotation, expiresAt: refreshRotation.expiresAt + 60 };
  assert.equal(guard.reserveWebForward("TOKEN_REFRESHED", accessRotation, () => 401)?.revisionId, 401);
  assert.equal(guard.reserveWebForward("TOKEN_REFRESHED", refreshRotation, () => 402)?.revisionId, 402);
  assert.equal(guard.reserveWebForward("TOKEN_REFRESHED", expiryRotation, () => 403)?.revisionId, 403);
  assert.equal(guard.reserveWebForward("TOKEN_REFRESHED", expiryRotation, () => 404), null);
});

test("explicit SIGNED_OUT is forwarded once until a newer login", () => {
  const guard = new NativeAuthEchoGuard();
  guard.reserveWebForward("SIGNED_IN", sessionA, () => 500);
  assert.equal(guard.reserveWebForward("SIGNED_OUT", null, () => 501)?.revisionId, 501);
  assert.equal(guard.reserveWebForward("SIGNED_OUT", null, () => 502), null);
  assert.equal(guard.reserveWebForward("SIGNED_IN", sessionB, () => 503)?.revisionId, 503);
  assert.equal(guard.reserveWebForward("SIGNED_OUT", null, () => 504)?.revisionId, 504);
});

test("duplicate observer events retain the transition revision", () => {
  const guard = new NativeAuthEchoGuard();
  const first = guard.reserveWebForward("SIGNED_IN", sessionA, () => 600);
  const duplicate = guard.reserveWebForward("SIGNED_IN", sessionA, () => 999);
  assert.equal(first?.revisionId, 600);
  assert.equal(duplicate, null);
});

test("revision generation is monotonic for genuine transitions", () => {
  const guard = new NativeAuthEchoGuard();
  assert.equal(guard.reserveWebForward("SIGNED_IN", sessionA, () => 700)?.revisionId, 700);
  assert.equal(guard.reserveWebForward("TOKEN_REFRESHED", sessionB, () => 699)?.revisionId, 701);
});

test("a failed in-flight import can be retried without admitting concurrent duplicates", () => {
  const guard = new NativeAuthEchoGuard();
  const reservation = guard.reserveWebForward("SIGNED_IN", sessionA, () => 800);
  assert.ok(reservation);
  assert.equal(guard.reserveWebForward("SIGNED_IN", sessionA, () => 801), null);
  guard.releaseWebForward(reservation);
  assert.equal(guard.reserveWebForward("SIGNED_IN", sessionA, () => 802)?.revisionId, 802);
});

test("repeated identical native events remain no-ops despite new revisions", () => {
  const guard = new NativeAuthEchoGuard();
  for (const revision of [100, 101, 102, 103]) {
    guard.observeNative(sessionA);
    assert.equal(guard.shouldApplyNative(sessionA, sessionA), false, `revision ${revision}`);
  }
});

test("Web SIGNED_IN to native notification cycle terminates after one logical sync", () => {
  const guard = new NativeAuthEchoGuard();
  let nativeImports = 0;
  let setSessionCalls = 0;

  if (guard.shouldForwardWeb("SIGNED_IN", sessionA)) {
    nativeImports += 1;
    guard.recordWebImport(sessionA);
  }
  guard.observeNative(sessionA);
  if (guard.shouldApplyNative(sessionA, sessionA)) {
    setSessionCalls += 1;
  }

  assert.equal(nativeImports, 1);
  assert.equal(setSessionCalls, 0);
  assert.equal(guard.shouldForwardWeb("SIGNED_IN", sessionA), false);
});

test("native cold-launch restore into empty Web session terminates after expected echo", () => {
  const guard = new NativeAuthEchoGuard();
  let setSessionCalls = 0;
  guard.observeNative(sessionA);
  if (guard.shouldApplyNative(null, sessionA)) {
    setSessionCalls += 1;
    guard.beginNativeApplication(sessionA);
  }
  assert.equal(guard.consumeExpectedWebEcho("SIGNED_IN", sessionA), true);
  assert.equal(guard.shouldForwardWeb("SIGNED_IN", sessionA), false);
  assert.equal(setSessionCalls, 1);
});

test("native refresh propagates once and its Web echo is suppressed", () => {
  const guard = new NativeAuthEchoGuard();
  guard.recordWebImport(sessionA);
  guard.observeNative(sessionB);
  assert.equal(guard.shouldApplyNative(sessionA, sessionB), true);
  guard.beginNativeApplication(sessionB);
  assert.equal(guard.consumeExpectedWebEcho("TOKEN_REFRESHED", sessionB), true);
  assert.equal(guard.shouldForwardWeb("TOKEN_REFRESHED", sessionB), false);
});

test("explicit Web and native sign-out are never treated as same-session no-ops", () => {
  const guard = new NativeAuthEchoGuard();
  guard.recordWebImport(sessionA);
  assert.equal(guard.shouldForwardWeb("SIGNED_OUT", null), true);
  guard.observeNative(null);
  assert.equal(guard.shouldApplyNative(sessionA, null), true);
});
