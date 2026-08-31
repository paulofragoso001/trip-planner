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
assert.deepEqual(Object.keys(tokens).sort(), ["colors", "contract", "radius", "semantic", "spacing"]);
assert.equal(tokens.contract.name, "Almidy Design Tokens");
assert.equal(tokens.contract.version, "2.0.0");
assert.deepEqual(tokens.contract.appearanceModes, ["light", "dark"]);
assert.equal(tokens.contract.accessibilityContrast, "platform-owned");
assert.deepEqual(Object.keys(tokens.colors).sort(), [
  "bg-light", "bg-light-mist", "border-subtle", "brand-gold",
  "brand-gold-deep", "brand-gold-text", "text-primary", "text-secondary"
]);
assert.deepEqual(Object.keys(tokens.spacing).sort(), ["card-padding", "content-inset", "element-gap"]);
assert.deepEqual(Object.keys(tokens.radius).sort(), ["card", "control"]);

const adaptiveRoles = [
  "accent", "accentPressed", "accentText",
  "canvas", "canvasGrouped", "surface", "surfaceNeutral",
  "textPrimary", "textSecondary", "textTertiary",
  "borderSubtle", "dividerSubtle", "borderStrong",
  "inputSurface", "inputBorder", "inputPlaceholder",
  "stateDisabledFill", "stateDisabledText", "success", "danger", "info"
];
for (const role of adaptiveRoles) {
  assert.deepEqual(Object.keys(tokens.semantic.colors[role]).sort(), ["dark", "light"]);
  assert.match(swiftSource, new RegExp(`static let ${role} = adaptive\\(`), `Swift is missing adaptive semantic ${role}`);
}
assert.match(swiftSource, /static let accentMuted = goldMuted/);
assert.match(swiftSource, /static let accentMutedSurface = goldMutedSurface/);
for (const role of ["onMediaPrimary", "onMediaSecondary", "onMediaTertiary", "overlayScrim"]) {
  assert.equal(typeof tokens.semantic.colors[role], "string");
  assert.match(swiftSource, new RegExp(`static let ${role} =`), `Swift is missing fixed semantic ${role}`);
}
for (const value of Object.values(tokens.semantic.colors)) {
  for (const color of typeof value === "string" ? [value] : Object.values(value)) {
    const match = color.match(/^#([0-9A-F]{6})$/i);
    if (match) {
      assert.ok(swiftSource.includes(`0x${match[1].toUpperCase()}`) || color === "#FFFFFF", `Swift is missing semantic value ${color}`);
    }
  }
}

assert.equal(tokens.semantic.typography.family, "Instrument Sans");
const typographyRoles = {
  displayHero: [52, 400], screenTitle: [24, 600], sheetTitle: [22, 600], sectionTitle: [20, 600],
  cardTitle: [17, 600], body: [17, 400], bodyCompact: [15, 400], bodyEmphasized: [17, 600],
  action: [17, 600], metadata: [13, 400], metadataEmphasis: [13, 600], caption: [12, 400], badge: [11, 700]
};
for (const [role, [size, weight]] of Object.entries(typographyRoles)) {
  assert.deepEqual(tokens.semantic.typography.roles[role], { size, weight });
  assert.match(foundationSource, new RegExp(`static let ${role} = Style\\(baseFont: Face\\.[a-z]+\\.font\\(ofSize: ${size}\\)`));
}
assert.deepEqual(Object.values(tokens.semantic.spacing), [4, 8, 12, 16, 20, 24, 32, 48]);
assert.deepEqual(tokens.semantic.radius, { small: 8, field: 12, control: 18, card: 24, cardLarge: 28 });
assert.deepEqual(tokens.semantic.elevation, ["controlSubtle", "controlRaised", "floating", "cardRaised", "sheet"]);
assert.deepEqual(tokens.semantic.border, ["hairline", "outline", "outlineStrong", "selected"]);

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
assert.match(typescriptSource, /export type AppearanceMode = "light" \| "dark"/);
assert.match(typescriptSource, /export function semanticColor/);
assert.match(typescriptSource, /export const webSemanticColors/);
assert.match(typescriptSource, /export const webDarkSemanticColors/);
assert.match(typescriptSource, /export const webSemanticTypography/);
assert.match(tailwindSource, /import \{ almidyTokens, webDarkSemanticColors, webSemanticColors, webSemanticTypography \} from "\.\/lib\/design-system\/almidy-tokens"/);
assert.match(tailwindSource, /fontSize: webSemanticTypography/);
assert.match(tailwindSource, /almidy: \["var\(--font-almidy-product\)"/);

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
