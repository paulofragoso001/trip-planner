import fs from "node:fs";
import path from "node:path";

const roots = ["ios/App/App", "ios/App/AppTests"];
const disallowed = [
  { label: "boldSystemFont", pattern: /\b(?:UIFont\.)?boldSystemFont\s*\(/g },
  { label: "UIFont.Weight bold/heavy/black", pattern: /\bUIFont\.Weight\.(?:bold|heavy|black)\b/g },
  { label: "bold/heavy/black weight argument", pattern: /\bweight\s*:\s*\.(?:bold|heavy|black)\b/g },
  { label: "bold/heavy/black fontWeight", pattern: /\bfontWeight\s*\(\s*\.(?:bold|heavy|black)\b/g },
];

function swiftFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return swiftFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".swift") ? [entryPath] : [];
  });
}

function withoutBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );
}

const violations = [];

for (const file of roots.flatMap(swiftFiles)) {
  const source = withoutBlockComments(fs.readFileSync(file, "utf8"));
  source.split("\n").forEach((line, index) => {
    const code = line.trimStart().startsWith("//") ? "" : line.split("//", 1)[0];
    for (const rule of disallowed) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(code)) {
        violations.push(`${file}:${index + 1}: ${rule.label}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Native typography guardrail failed. Heavy app font weights are not allowed:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log("Native typography guardrails verified: no bold, heavy, or black app font weights.");
