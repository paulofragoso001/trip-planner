import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [canonicalSource, swiftSource, tailwindSource, typescriptSource] = await Promise.all([
  readFile(new URL("design-system/almidy.tokens.json", root), "utf8"),
  readFile(new URL("ios/App/App/AlmidyDesignTokens.swift", root), "utf8"),
  readFile(new URL("tailwind.config.ts", root), "utf8"),
  readFile(new URL("lib/design-system/almidy-tokens.ts", root), "utf8")
]);

const tokens = JSON.parse(canonicalSource);
const expected = {
  colors: {
    "brand-gold": "#D6A84F",
    "brand-gold-deep": "#B88A2E",
    "brand-gold-text": "#8C641E",
    "bg-light": "#FFFFFF",
    "bg-light-mist": "#F2F3F6",
    "text-primary": "#050505",
    "text-secondary": "#7D7D84",
    "border-subtle": "rgba(0,0,0,0.10)"
  },
  spacing: {
    "card-padding": "16px",
    "element-gap": "12px",
    "content-inset": "24px"
  },
  radius: {
    card: "24px",
    control: "18px"
  }
};

assert.deepEqual(tokens, expected, "Canonical token JSON does not match the approved contract");

const swiftHexTokens = {
  brandGold: tokens.colors["brand-gold"],
  brandGoldDeep: tokens.colors["brand-gold-deep"],
  brandGoldText: tokens.colors["brand-gold-text"],
  bgLight: tokens.colors["bg-light"],
  bgLightMist: tokens.colors["bg-light-mist"],
  canonicalTextPrimary: tokens.colors["text-primary"],
  canonicalTextSecondary: tokens.colors["text-secondary"]
};

for (const [name, value] of Object.entries(swiftHexTokens)) {
  const hex = value.slice(1).toUpperCase();
  assert.match(
    swiftSource,
    new RegExp(`static let ${name} = UIColor\\(hex: 0x${hex}\\)`),
    `Swift token ${name} is not aligned with ${value}`
  );
}

assert.match(swiftSource, /static let borderSubtle = UIColor\.black\.withAlphaComponent\(0\.10\)/);
assert.match(swiftSource, /static let cardPadding = md/);
assert.match(swiftSource, /static let elementGap = sm/);
assert.match(swiftSource, /static let contentInset = lg/);
assert.match(swiftSource, /static let card: CGFloat = 24/);
assert.match(swiftSource, /static let control: CGFloat = 18/);

assert.match(typescriptSource, /import canonicalTokens from "\.\.\/\.\.\/design-system\/almidy\.tokens\.json"/);
assert.match(tailwindSource, /import \{ almidyTokens \} from "\.\/lib\/design-system\/almidy-tokens"/);

for (const group of ["colors", "spacing", "radius"]) {
  for (const key of Object.keys(tokens[group])) {
    assert.ok(
      typescriptSource.includes(`"${key}"`) || typescriptSource.includes(`${key}:`),
      `TypeScript contract is missing ${group}.${key}`
    );
  }
}

for (const key of Object.keys(tokens.colors)) {
  assert.ok(
    tailwindSource.includes(`"${key}": almidyTokens.colors["${key}"]`),
    `Tailwind colors are missing canonical alias ${key}`
  );
}

for (const key of Object.keys(tokens.spacing)) {
  assert.ok(
    tailwindSource.includes(`"${key}": almidyTokens.spacing["${key}"]`),
    `Tailwind spacing is missing canonical alias ${key}`
  );
}

for (const key of Object.keys(tokens.radius)) {
  assert.ok(
    tailwindSource.includes(`${key}: almidyTokens.radius.${key}`),
    `Tailwind radius is missing canonical alias ${key}`
  );
}

console.log("Almidy design token parity verified.");
