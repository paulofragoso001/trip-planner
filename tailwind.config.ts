import type { Config } from "tailwindcss";
import { almidyTokens, webSemanticColors } from "./lib/design-system/almidy-tokens";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(
          Object.entries(webSemanticColors).map(([name, value]) => [`almidy-${name}`, value]),
        ),
        "brand-gold": almidyTokens.colors["brand-gold"],
        "brand-gold-deep": almidyTokens.colors["brand-gold-deep"],
        "brand-gold-text": almidyTokens.colors["brand-gold-text"],
        "bg-light": almidyTokens.colors["bg-light"],
        "bg-light-mist": almidyTokens.colors["bg-light-mist"],
        "text-primary": almidyTokens.colors["text-primary"],
        "text-secondary": almidyTokens.colors["text-secondary"],
        "border-subtle": almidyTokens.colors["border-subtle"],
        ink: webSemanticColors["text-primary"],
        mist: webSemanticColors["canvas-grouped"],
        line: webSemanticColors["border-subtle"],
        brand: webSemanticColors.accent,
        evergreen: "#14805e"
      },
      spacing: {
        "card-padding": almidyTokens.spacing["card-padding"],
        "element-gap": almidyTokens.spacing["element-gap"],
        "content-inset": almidyTokens.spacing["content-inset"]
      },
      borderRadius: {
        card: almidyTokens.radius.card,
        control: almidyTokens.radius.control
      },
      boxShadow: {
        panel: "0 18px 60px rgba(24, 38, 58, 0.12)"
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.45s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
