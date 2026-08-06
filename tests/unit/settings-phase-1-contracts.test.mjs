import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("avatar policy is exact-prefix owned, MIME constrained, and publicly readable by explicit product decision", () => {
  const sql = read("supabase/migrations/20260806111021_settings_phase_1_account_security.sql");
  assert.match(sql, /array_length\(storage\.foldername\(name\), 1\) = 1/);
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)::text\)/);
  assert.match(sql, /image\/jpeg.*image\/png.*image\/webp/s);
  assert.match(sql, /keeps avatars public/);
  assert.match(sql, /for delete to authenticated/);
});

test("all persisted notification fields are represented in the shared contract and mounted UI", () => {
  const contract = read("lib/account/contracts.ts");
  const ui = read("components/NotificationSettings.tsx");
  for (const field of ["email_comments", "email_mentions", "inapp_comments", "inapp_mentions"]) {
    assert.match(contract, new RegExp(field)); assert.match(ui, new RegExp(field));
  }
  assert.doesNotMatch(read("app/api/preferences/route.ts"), /parsedBody\.user_id|user_id.*optional/);
});

test("profile and password APIs derive ownership and target email from authenticated context", () => {
  const profile = read("app/api/account/profile/route.ts");
  const password = read("app/api/account/password-reset/route.ts");
  assert.match(profile, /id: auth\.userId/); assert.doesNotMatch(profile, /userId.*safeParse/);
  assert.match(password, /auth\.userEmail/); assert.match(password, /does not accept an email address/);
  assert.match(password, /\/auth\/reset-password/);
});

test("avatar replacement order preserves old state on profile failure and never deletes external URLs", () => {
  const route = read("app/api/account/avatar/route.ts");
  assert.ok(route.indexOf("storage.upload") < route.indexOf("storage.list"));
  assert.ok(route.indexOf("storage.list") < route.indexOf("avatar_url: publicData.publicUrl"));
  assert.ok(route.indexOf("if (profileError)") < route.lastIndexOf("if (oldPath"));
  assert.match(read("lib/avatar.ts"), /return null/);
});
