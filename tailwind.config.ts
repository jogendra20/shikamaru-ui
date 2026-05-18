import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0A0A0F",
        secondary: "#0F0F17",
        panel: "#12121C",
        card: "#1A1A28",
        accent: "#F59E0B",
        border: "#1E1E2E",
        muted: "#8888AA",
      },
      fontFamily: {
        sans: ["Geist", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
