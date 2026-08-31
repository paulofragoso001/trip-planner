import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const tokens = JSON.parse(fs.readFileSync("design-system/almidy.tokens.json", "utf8"));
const tailwind = fs.readFileSync("tailwind.config.ts", "utf8");
const globals = fs.readFileSync("app/globals.css", "utf8");
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
