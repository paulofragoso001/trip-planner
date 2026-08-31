import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [canonicalSource, swiftSource, foundationSource, tailwindSource, typescriptSource] = await Promise.all([
  readFile(new URL("design-system/almidy.tokens.json", root), "utf8"),
  readFile(new URL("ios/App/App/AlmidyDesignTokens.swift", root), "utf8"),
  readFile(new URL("ios/App/App/DesignSystem/AlmidyDesignFoundation.swift", root), "utf8"),
  readFile(new URL("tailwind.config.ts", root), "utf8"),
  readFile(new URL("lib/design-system/almidy-tokens.ts", root), "utf8")
]);

const tokens = JSON.parse(canonicalSource);
assert.deepEqual(Object.keys(tokens).sort(), ["colors", "radius", "spacing"]);
assert.deepEqual(Object.keys(tokens.colors).sort(), [
  "bg-light", "bg-light-mist", "border-subtle", "brand-gold",
  "brand-gold-deep", "brand-gold-text", "text-primary", "text-secondary"
]);
assert.deepEqual(Object.keys(tokens.spacing).sort(), ["card-padding", "content-inset", "element-gap"]);
assert.deepEqual(Object.keys(tokens.radius).sort(), ["card", "control"]);

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

assert.match(swiftSource, /static let borderSubtle = adaptive\([\s\S]*?light: UIColor\.black\.withAlphaComponent\(0\.10\)/);
const pixelValue = (value) => Number.parseFloat(value.replace("px", ""));
assert.match(swiftSource, /static let md: CGFloat = 16/);
assert.match(swiftSource, /static let sm: CGFloat = 12/);
assert.match(swiftSource, /static let lg: CGFloat = 24/);
assert.equal(pixelValue(tokens.spacing["card-padding"]), 16);
assert.equal(pixelValue(tokens.spacing["element-gap"]), 12);
assert.equal(pixelValue(tokens.spacing["content-inset"]), 24);
assert.equal(pixelValue(tokens.radius.card), 24);
assert.equal(pixelValue(tokens.radius.control), 18);
assert.match(swiftSource, /static let cardPadding = md/);
assert.match(swiftSource, /static let elementGap = sm/);
assert.match(swiftSource, /static let contentInset = lg/);
assert.match(swiftSource, /static let card: CGFloat = 24/);
assert.match(swiftSource, /static let control: CGFloat = 18/);
assert.match(swiftSource, /static let accent = adaptive\(light: brandGold,/);
assert.match(swiftSource, /static let canvas = adaptive\(light: bgLight,/);
assert.match(swiftSource, /static let surfaceNeutral = adaptive\(light: bgLightMist,/);
assert.match(foundationSource, /enum Typography/);
assert.match(foundationSource, /enum Elevation/);
assert.match(foundationSource, /enum Component/);

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
