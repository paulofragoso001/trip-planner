import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const tokens = JSON.parse(fs.readFileSync("design-system/almidy.tokens.json", "utf8"));
const tailwind = fs.readFileSync("tailwind.config.ts", "utf8");
const globals = fs.readFileSync("app/globals.css", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const roots = ["app", "components", "lib"];

function productionFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(entryPath);
    return entry.isFile() && /\.(?:css|js|jsx|ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

const sources = roots.flatMap(productionFiles).map((file) => [file, fs.readFileSync(file, "utf8")]);
const legacyClass = /(?:^|[\s"'`])(?:[a-z-]+:)*(?:bg|text|border|ring|divide|from|via|to|fill|stroke|outline)-(ink|line|brand)(?=$|[\s"'`/:\]])/g;
const violations = [];

for (const [file, source] of sources) {
  for (const match of source.matchAll(legacyClass)) violations.push(`${file}: ${match[0].trim()}`);
  if (/#D6A84F/i.test(source)) violations.push(`${file}: duplicate raw canonical accent`);
}

assert.deepEqual(violations, [], `Web semantic adoption drift:\n${violations.join("\n")}`);
assert.match(tailwind, /ink: webSemanticColors\["text-primary"\]/);
assert.match(tailwind, /mist: webSemanticColors\["canvas-grouped"\]/);
assert.match(tailwind, /line: webSemanticColors\["border-subtle"\]/);
assert.match(tailwind, /brand: webSemanticColors\.accent/);
assert.match(globals, /--almidy-color-accent: theme\("colors\.almidy-accent"\)/);
assert.match(globals, /var\(--almidy-color-accent\)/);
assert.match(globals, /@apply[^;]*font-almidy/);
assert.match(layout, /localFont from "next\/font\/local"/);
assert.match(layout, /variable: "--font-almidy-product"/);
for (const [file, weight] of [
  ["InstrumentSans-Regular.ttf", "400"],
  ["InstrumentSans-Medium.ttf", "500"],
  ["InstrumentSans-SemiBold.ttf", "600"],
  ["InstrumentSans-Bold.ttf", "700"],
]) {
  assert.ok(layout.includes(file), `Instrument Sans registration is missing ${file}`);
  assert.match(layout, new RegExp(`weight: "${weight}"`));
}

const reconciledDarkFiles = [
  "components/ui/mobile-form.tsx",
  "components/trip/trip-segment-form.tsx",
];
for (const file of reconciledDarkFiles) {
  const source = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(source, /#(?:1f1f21|1e1e24|25252d)/i, `${file} reintroduced a reconciled dark neutral`);
}
assert.doesNotMatch(
  fs.readFileSync("components/DraggableList.tsx", "utf8"),
  /selected\s*\?[^\n]*bg-blue-50/,
  "DraggableList reintroduced the legacy blue selected fill",
);

const consolidatedComponentFiles = [
  "components/Auth.tsx",
  "components/AuthPage.tsx",
  "components/account/profile-settings-form.tsx",
  "components/account/password-reset-button.tsx",
  "components/account/reset-password-form.tsx",
  "components/account/user-preferences-settings.tsx",
];
const consolidatedSources = consolidatedComponentFiles.map((file) => [file, fs.readFileSync(file, "utf8")]);

for (const [file, source] of consolidatedSources) {
  assert.doesNotMatch(
    source,
    /min-h-11 rounded-xl border border-almidy-border-subtle (?:bg-white )?px-3/,
    `${file} reconstructs the consolidated ordinary form-control signature`,
  );
  assert.doesNotMatch(
    source,
    /rounded-\[1\.75rem\] border border-almidy-border-subtle bg-white p-5 shadow-panel/,
    `${file} reconstructs the consolidated ordinary card signature`,
  );
  assert.doesNotMatch(
    source,
    /rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50/,
    `${file} reconstructs the consolidated compact neutral action signature`,
  );
}

assert.match(fs.readFileSync("components/ui/almidy-button.tsx", "utf8"), /type AlmidyButtonVariant = "primary" \| "neutral"/);
assert.match(fs.readFileSync("components/ui/almidy-form-control.tsx", "utf8"), /export const AlmidyInput/);
assert.match(fs.readFileSync("components/ui/almidy-form-control.tsx", "utf8"), /export const AlmidySelect/);
assert.match(fs.readFileSync("components/ui/almidy-card.tsx", "utf8"), /export const almidyCardClassName/);

const equivalence = {
  accent: [tokens.colors["brand-gold"], tokens.semantic.colors.accent.light],
  canvasGrouped: [tokens.colors["bg-light-mist"], tokens.semantic.colors.canvasGrouped.light],
  textPrimary: [tokens.colors["text-primary"], tokens.semantic.colors.textPrimary.light],
  borderSubtle: [tokens.colors["border-subtle"], tokens.semantic.colors.borderSubtle.light],
};

for (const [role, [before, after]] of Object.entries(equivalence)) {
  assert.equal(after, before, `${role} compatibility value changed`);
  console.log(`${role}: identical (${after})`);
}

console.log("Web Tier A semantic adoption verified: compatibility aliases and rendered values are unchanged.");
