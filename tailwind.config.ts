import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#15202b",
        mist: "#eaf0f4",
        line: "#d9e0e8",
        brand: "#1f6feb",
        evergreen: "#14805e"
      },
      boxShadow: {
        panel: "0 18px 60px rgba(24, 38, 58, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
