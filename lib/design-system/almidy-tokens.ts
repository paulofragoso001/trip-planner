import canonicalTokens from "../../design-system/almidy.tokens.json";

export type AppearanceMode = "light" | "dark";
export type AdaptiveColor = Record<AppearanceMode, string>;
export type SemanticColor = AdaptiveColor | string;
export type TypographyRole = { size: number; weight: number };

export type AlmidyTokenContract = {
  contract: { name: string; version: string; appearanceModes: AppearanceMode[]; accessibilityContrast: "platform-owned" };
  semantic: {
    colors: Record<string, SemanticColor>;
    typography: { family: string; roles: Record<string, TypographyRole> };
    spacing: Record<string, number>;
    radius: Record<string, number>;
    shape: { circle: "circle"; capsule: "capsule" };
    elevation: string[];
    border: string[];
  };
  colors: Record<string, string>;
  spacing: Record<string, string>;
  radius: Record<string, string>;
};

export const almidyTokens = canonicalTokens as AlmidyTokenContract;

export function semanticColor(name: keyof typeof canonicalTokens.semantic.colors, mode: AppearanceMode): string {
  const value = canonicalTokens.semantic.colors[name];
  return typeof value === "string" ? value : value[mode];
}

export const webSemanticColors = {
  accent: semanticColor("accent", "light"),
  "accent-pressed": semanticColor("accentPressed", "light"),
  "accent-text": semanticColor("accentText", "light"),
  "accent-muted": semanticColor("accentMuted", "light"),
  "accent-muted-surface": semanticColor("accentMutedSurface", "light"),
  canvas: semanticColor("canvas", "light"),
  "canvas-grouped": semanticColor("canvasGrouped", "light"),
  surface: semanticColor("surface", "light"),
  "surface-neutral": semanticColor("surfaceNeutral", "light"),
  "text-primary": semanticColor("textPrimary", "light"),
  "text-secondary": semanticColor("textSecondary", "light"),
  "text-tertiary": semanticColor("textTertiary", "light"),
  "border-subtle": semanticColor("borderSubtle", "light"),
  "divider-subtle": semanticColor("dividerSubtle", "light"),
  "border-strong": semanticColor("borderStrong", "light"),
  "input-surface": semanticColor("inputSurface", "light"),
  "input-border": semanticColor("inputBorder", "light"),
  "input-placeholder": semanticColor("inputPlaceholder", "light"),
  success: semanticColor("success", "light"),
  danger: semanticColor("danger", "light"),
  info: semanticColor("info", "light"),
} as const;

export const webDarkSemanticColors = {
  canvas: semanticColor("canvas", "dark"),
  "canvas-grouped": semanticColor("canvasGrouped", "dark"),
  surface: semanticColor("surface", "dark"),
  "surface-neutral": semanticColor("surfaceNeutral", "dark"),
  "input-surface": semanticColor("inputSurface", "dark"),
} as const;

const typographyRoles = canonicalTokens.semantic.typography.roles;

type WebTypographyValue = [string, { fontWeight: string; lineHeight: string; letterSpacing?: string }];

export const webSemanticTypography: Record<string, WebTypographyValue> = {
  "almidy-display-hero": [
    `clamp(${typographyRoles.displayHero.size}px, 2.75rem + 1.25vw, 72px)`,
    { fontWeight: `${typographyRoles.displayHero.weight}`, lineHeight: "1.02", letterSpacing: "-0.035em" },
  ],
  "almidy-screen-title": [`${typographyRoles.screenTitle.size}px`, { fontWeight: `${typographyRoles.screenTitle.weight}`, lineHeight: "1.2" }],
  "almidy-sheet-title": [`${typographyRoles.sheetTitle.size}px`, { fontWeight: `${typographyRoles.sheetTitle.weight}`, lineHeight: "28px" }],
  "almidy-section-title": [`${typographyRoles.sectionTitle.size}px`, { fontWeight: `${typographyRoles.sectionTitle.weight}`, lineHeight: "26px" }],
  "almidy-card-title": [`${typographyRoles.cardTitle.size}px`, { fontWeight: `${typographyRoles.cardTitle.weight}`, lineHeight: "22px" }],
  "almidy-body": [`${typographyRoles.body.size}px`, { fontWeight: `${typographyRoles.body.weight}`, lineHeight: "24px" }],
  "almidy-body-compact": [`${typographyRoles.bodyCompact.size}px`, { fontWeight: `${typographyRoles.bodyCompact.weight}`, lineHeight: "20px" }],
  "almidy-body-emphasized": [`${typographyRoles.bodyEmphasized.size}px`, { fontWeight: `${typographyRoles.bodyEmphasized.weight}`, lineHeight: "24px" }],
  "almidy-action": [`${typographyRoles.action.size}px`, { fontWeight: `${typographyRoles.action.weight}`, lineHeight: "22px" }],
  "almidy-metadata": [`${typographyRoles.metadata.size}px`, { fontWeight: `${typographyRoles.metadata.weight}`, lineHeight: "18px" }],
  "almidy-metadata-emphasis": [`${typographyRoles.metadataEmphasis.size}px`, { fontWeight: `${typographyRoles.metadataEmphasis.weight}`, lineHeight: "18px" }],
  "almidy-caption": [`${typographyRoles.caption.size}px`, { fontWeight: `${typographyRoles.caption.weight}`, lineHeight: "16px" }],
  "almidy-badge": [`${typographyRoles.badge.size}px`, { fontWeight: `${typographyRoles.badge.weight}`, lineHeight: "14px" }],
};

export default almidyTokens;
