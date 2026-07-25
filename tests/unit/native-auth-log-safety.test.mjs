import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [mainViewController, plugin, bridge] = await Promise.all([
  readFile("ios/App/App/MainViewController.swift", "utf8"),
  readFile("ios/App/App/NativeMapPlugin.swift", "utf8"),
  readFile("components/native/capacitor-auth-session-bridge.tsx", "utf8")
]);

test("Capacitor call and result logging is disabled for every build", () => {
  assert.match(mainViewController, /descriptor\.loggingBehavior\s*=\s*\.none/);
});

test("native auth success responses contain only a success flag", () => {
  const method = plugin.slice(
    plugin.indexOf("@objc func syncNativeAuthSession"),
    plugin.indexOf("@objc func clearNativeAuthSession")
  );
  const resolutions = [...method.matchAll(/call\.resolve\(([^\n]+)\)/g)].map((match) => match[1]);
  assert.ok(resolutions.length >= 2);
  assert.ok(resolutions.every((value) => value.trim() === '["success": true]'));
  assert.doesNotMatch(method, /call\.resolve\([^\n]*(accessToken|refreshToken|Authorization|Cookie)/);
  const logStatements = method.match(/authLogger\.(?:info|error|warning|debug)\([^\n]+/g) ?? [];
  assert.ok(logStatements.length >= 4);
  assert.ok(logStatements.every((statement) => !/(accessToken|refreshToken|Authorization|Cookie|jsonString)/.test(statement)));
});

test("Web bridge errors are logged structurally instead of serializing error objects", () => {
  assert.match(bridge, /reportNativeAuthBridgeFailure\("sync_web_session_to_native", error\)/);
  assert.doesNotMatch(bridge, /console\.error\([^\n]*,\s*error\s*\)/);
  assert.doesNotMatch(bridge, /console\.(?:log|debug|info|warn)\([^\n]*(accessToken|refreshToken|jsonString)/);
});

test("controlled Web diagnostics do not log full URLs that may contain OAuth codes", () => {
  assert.doesNotMatch(mainViewController, /href:\s*window\.location\.href/);
});

test("late native listener registration is removed after bridge unmount", () => {
  assert.match(
    bridge,
    /if \(!isMounted\) \{\s*void listener\.remove\(\);\s*return;\s*\}/
  );
  assert.match(bridge, /authListener\.data\.subscription\.unsubscribe\(\)/);
});
