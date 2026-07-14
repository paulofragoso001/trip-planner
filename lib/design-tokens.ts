/** Shared semantic values for the web surfaces mirrored by UIKit tokens. */
export const almidyDesignTokens = {
  color: {
    brandOrange: "#ff7a2a",
    brandOrangeStrong: "#ff6b1a",
    authSurface: "#fff9f4",
    walletSurface: "#ffffff",
    textPrimary: "#0b1020",
    textSecondary: "#8d8d94",
    borderSoft: "#e5e7eb"
  },
  spacing: {
    content: "1.5rem",
    safeTop: "env(safe-area-inset-top)",
    safeBottom: "env(safe-area-inset-bottom)",
    section: "2rem"
  },
  radius: {
    sheet: "2rem",
    card: "1.75rem",
    pill: "999px"
  },
  control: {
    buttonHeight: "4rem",
    compactButtonHeight: "3.375rem"
  },
  fontWeight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700"
  }
} as const;
