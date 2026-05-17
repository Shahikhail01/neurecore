/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // ── Color tokens — all backed by CSS variables so theme-switching works ─
      colors: {
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
          border: "var(--surface-border)",
          muted: "var(--surface-muted)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          subtle: "var(--brand-subtle)",
          dim: "var(--brand-dim)",
          foreground: "var(--brand-fg)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },
        status: {
          profit: "var(--status-profit)",
          risk: "var(--status-risk)",
          ops: "var(--status-ops)",
          strategy: "var(--status-strategy)",
          warn: "var(--status-warn)",
          neutral: "var(--status-neutral)",
        },
      },
      // ── Typography ───────────────────────────────────────────────────────────
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        display: [
          "2rem",
          { lineHeight: "2.5rem", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        heading: [
          "1.25rem",
          {
            lineHeight: "1.75rem",
            letterSpacing: "-0.01em",
            fontWeight: "600",
          },
        ],
        subheading: ["1rem", { lineHeight: "1.5rem", fontWeight: "500" }],
        body: ["0.875rem", { lineHeight: "1.5rem" }],
        caption: ["0.75rem", { lineHeight: "1.25rem" }],
        micro: ["0.6875rem", { lineHeight: "1rem" }],
      },
      // ── Spacing ──────────────────────────────────────────────────────────────
      spacing: {
        page: "1.5rem",
        panel: "1rem",
        card: "1.25rem",
        tight: "0.75rem",
      },
      // ── Radius ───────────────────────────────────────────────────────────────
      borderRadius: {
        card: "0.75rem",
        input: "0.5rem",
        pill: "9999px",
      },
      // ── Elevation / shadows ───────────────────────────────────────────────────
      boxShadow: {
        surface: "0 0 0 1px var(--surface-border)",
        raised: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px var(--surface-border)",
        float: "0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px var(--surface-border)",
        brand: "0 0 0 2px var(--brand-subtle)",
      },
      // ── Motion ───────────────────────────────────────────────────────────────
      transitionDuration: {
        instant: "80ms",
        fast: "150ms",
        normal: "250ms",
        slow: "400ms",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.175, 0.885, 0.32, 1.1)",
        "ease-out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
