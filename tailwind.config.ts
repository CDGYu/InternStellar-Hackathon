import type { Config } from "tailwindcss";

/**
 * InternStellar — Neumorphic (Soft UI) design tokens.
 *
 * Colors and shadows are wired to the CSS variables defined in
 * app/globals.css. That keeps `dark:` variants out of every component
 * — flipping `.dark` on <html> swaps the variables and the entire UI
 * shifts atomically. See globals.css for the actual values.
 *
 * `rgb(var(--token) / <alpha-value>)` is Tailwind's opacity-modifier
 * syntax, so `bg-surface/85` still works without us having to spell
 * out every alpha case explicitly.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
          placeholder: "rgb(var(--color-ink-placeholder) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          light: "rgb(var(--color-accent-light) / <alpha-value>)",
          teal: "rgb(var(--color-accent-teal) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "2rem",
      },
      boxShadow: {
        // Extruded (raised). The rgba channels reference the CSS vars
        // defined in globals.css so the shadow re-tunes itself when
        // `.dark` flips on <html>.
        neu:
          "9px 9px 16px rgba(var(--neu-shadow-dark-rgb), var(--neu-shadow-dark-alpha-1)), " +
          "-9px -9px 16px rgba(var(--neu-shadow-light-rgb), var(--neu-shadow-light-alpha-1))",
        "neu-sm":
          "5px 5px 10px rgba(var(--neu-shadow-dark-rgb), var(--neu-shadow-dark-alpha-1)), " +
          "-5px -5px 10px rgba(var(--neu-shadow-light-rgb), var(--neu-shadow-light-alpha-1))",
        "neu-hover":
          "12px 12px 20px rgba(var(--neu-shadow-dark-rgb), var(--neu-shadow-dark-alpha-2)), " +
          "-12px -12px 20px rgba(var(--neu-shadow-light-rgb), var(--neu-shadow-light-alpha-2))",
        "neu-inset":
          "inset 6px 6px 10px rgba(var(--neu-shadow-dark-rgb), var(--neu-shadow-dark-alpha-1)), " +
          "inset -6px -6px 10px rgba(var(--neu-shadow-light-rgb), var(--neu-shadow-light-alpha-1))",
        "neu-inset-sm":
          "inset 3px 3px 6px rgba(var(--neu-shadow-dark-rgb), var(--neu-shadow-dark-alpha-1)), " +
          "inset -3px -3px 6px rgba(var(--neu-shadow-light-rgb), var(--neu-shadow-light-alpha-1))",
        "neu-inset-deep":
          "inset 10px 10px 20px rgba(var(--neu-shadow-dark-rgb), var(--neu-shadow-dark-alpha-2)), " +
          "inset -10px -10px 20px rgba(var(--neu-shadow-light-rgb), var(--neu-shadow-light-alpha-2))",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
