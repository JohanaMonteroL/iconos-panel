import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["selector", "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        // Tokens del design system (referenciados como bg-base, text-primary, etc.)
        "bg-base":      "var(--bg-base)",
        "bg-surface":   "var(--bg-surface)",
        "bg-elevated":  "var(--bg-elevated)",
        "bg-overlay":   "var(--bg-overlay)",
        "bg-input":     "var(--bg-input)",
        "border-subtle":  "var(--border-subtle)",
        "border-default": "var(--border-default)",
        "border-strong":  "var(--border-strong)",
        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary":  "var(--text-tertiary)",
        "text-disabled":  "var(--text-disabled)",
        "text-inverse":   "var(--text-inverse)",
        "state-success":  "var(--state-success)",
        "state-warning":  "var(--state-warning)",
        "state-error":    "var(--state-error)",
        "state-info":     "var(--state-info)",
      },
      spacing: {
        // Escala de espaciado del design system (4px base)
        "space-1":  "4px",
        "space-2":  "8px",
        "space-3":  "12px",
        "space-4":  "16px",
        "space-5":  "20px",
        "space-6":  "24px",
        "space-8":  "32px",
        "space-10": "40px",
        "space-12": "48px",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
      },
      fontFamily: {
        sans: ['"Google Sans Flex"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
