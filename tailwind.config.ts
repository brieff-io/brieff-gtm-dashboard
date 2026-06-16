import type { Config } from "tailwindcss";

// Brieff brand accents reused for the internal dashboard.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#23346F", // Brieff blue
          deep: "#1A2755",
          soft: "#E8EBF4",
        },
        azure: { DEFAULT: "#2F62D9", soft: "#E7EEFC" },
        ink: "#161A23",
        slate: "#4A5260",
        steel: "#6B7280",
        hairline: "#E5E7EB",
        canvas: "#F7F8FA",
        success: "#1F9D62",
        warn: "#D98A1F",
        error: "#D64545",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
