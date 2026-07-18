import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const sourceRoots = ["app", "components", "lib", "docs", "ios/App/App"];
const productCopyRoots = ["app", "components", "lib", "docs", "ios/App/App"];
const nativeRoot = "ios/App/App";
const textExtensions = new Set([
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".swift",
  ".ts",
  ".tsx",
]);
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function filesUnder(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return filesUnder(entryPath);
    return entry.isFile() && textExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*#.*$/gm, "");
}

function findMatches(files, rules, { comments = true } = {}) {
  const violations = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const source = comments ? raw : stripComments(raw);
    source.split("\n").forEach((line, index) => {
      for (const rule of rules) {
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(line)) {
          violations.push(`${file}:${index + 1}: ${rule.label}`);
        }
      }
    });
  }
  return violations;
}

const allSourceFiles = sourceRoots.flatMap(filesUnder);
const productCopyFiles = productCopyRoots.flatMap(filesUnder);
const nativeFiles = filesUnder(nativeRoot).filter((file) => file.endsWith(".swift"));

const violations = [
  ...findMatches(productCopyFiles, [
    { label: "legacy Tripsy product copy", pattern: /\bTripsy\b/g },
    { label: "hardcoded Barcelona sample trip", pattern: /Barcelona Sample Trip/g },
  ]),
  ...findMatches(allSourceFiles, [
    { label: "removed unsynced native-trip fallback constructor", pattern: /\basNativeTrip\b/g },
  ], { comments: false }),
  ...findMatches(nativeFiles, [
    { label: "native system-orange UI color", pattern: /\b(?:UIColor\.)?systemOrange\b|\bUIColor\.orange\b/g },
    { label: "legacy native orange literal", pattern: /(?:#|0x)(?:FF6B[0-9A-Fa-f]{2}|FF7A[0-9A-Fa-f]{2}|F97316|EA580C|E67E22)\b/gi },
    { label: "native system-blue action color", pattern: /\b(?:UIColor\.)?systemBlue\b|\bUIColor\.blue\b/g },
    { label: "pure-blue native literal", pattern: /(?:#|0x)0000FF\b/gi },
  ], { comments: false }),
];

if (violations.length > 0) {
  console.error("Almidy regression guardrails failed:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  console.error("Use semantic Almidy tokens. Provider colors and semantic map/system blue require a narrow, documented exception.");
  process.exit(1);
}

// Keep font rules in their dedicated checker so the pattern contract has one owner.
execFileSync(process.execPath, ["scripts/check-native-typography-guardrails.mjs"], {
  stdio: "inherit",
});

console.log("Almidy regression guardrails verified: product copy, sample data, native fallback, and native action colors.");
console.log("Route ownership remains enforced by NativeMapConnectivityTests.");
