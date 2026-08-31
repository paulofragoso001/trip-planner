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

export default almidyTokens;
