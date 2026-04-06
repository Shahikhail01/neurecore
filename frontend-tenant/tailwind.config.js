/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class", // Allow .theme-dark class to control dark mode
  theme: {
    colors: {
      transparent: "transparent",
      white: "#ffffff",
      black: "#000000",

      // ─── Surface colors (background, cards, panels) ───
      surface: {
        DEFAULT: "var(--surface-base)",
        base: "var(--surface-base)",
        raised: "var(--surface-raised)",
        overlay: "var(--surface-overlay)",
        border: "var(--surface-border)",
        muted: "var(--surface-muted)",
        brand: "var(--surface-brand)",
      },

      // ─── Text colors ───
      text: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        disabled: "var(--text-disabled)",
      },

      // ─── Accent colors (primary brand color) ───
      accent: {
        primary: "var(--accent-primary)",
        600: "var(--accent-600)",
        50: "var(--accent-50)",
        hover: "var(--accent-hover)",
        active: "var(--accent-active)",
      },

      // ─── Status colors ───
      status: {
        success: "var(--status-success)",
        "success-light": "var(--status-success-light)",
        warning: "var(--status-warning)",
        "warning-light": "var(--status-warning-light)",
        danger: "var(--status-danger)",
        "danger-light": "var(--status-danger-light)",
        info: "var(--status-info)",
        "info-light": "var(--status-info-light)",
      },

      // ─── Neutral grays ───
      neutral: {
        50: "var(--neutral-100)",
        100: "var(--neutral-100)",
        200: "var(--neutral-200)",
        300: "var(--neutral-300)",
        400: "var(--neutral-400)",
        500: "var(--neutral-500)",
        600: "var(--neutral-600)",
        700: "var(--neutral-700)",
        800: "var(--neutral-800)",
        900: "var(--neutral-900)",
      },
    },
    spacing: {
      0: "0",
      px: "1px",
      xs: "var(--space-xs)", // 8px
      sm: "var(--space-sm)", // 12px
      md: "var(--space-md)", // 16px
      lg: "var(--space-lg)", // 24px
      xl: "var(--space-xl)", // 32px
      "2xl": "var(--space-2xl)", // 48px

      // Additional standard sizes for Tailwind compatibility
      1: "0.25rem",
      2: "0.5rem",
      3: "0.75rem",
      4: "1rem",
      5: "1.25rem",
      6: "1.5rem",
      7: "1.75rem",
      8: "2rem",
      9: "2.25rem",
      10: "2.5rem",
      12: "3rem",
      14: "3.5rem",
      16: "4rem",
      20: "5rem",
      24: "6rem",
      28: "7rem",
      32: "8rem",
      36: "9rem",
      40: "10rem",
      44: "11rem",
      48: "12rem",
      52: "13rem",
      56: "14rem",
      60: "15rem",
      64: "16rem",
      72: "18rem",
      80: "20rem",
      96: "24rem",
    },
    borderRadius: {
      none: "0",
      sm: "var(--radius-sm)", // 6px
      md: "var(--radius-md)", // 8px
      lg: "var(--radius-lg)", // 12px
      xl: "var(--radius-xl)", // 16px
      full: "var(--radius-full)", // 9999px
    },
    boxShadow: {
      none: "none",
      xs: "var(--shadow-xs)",
      sm: "var(--shadow-sm)",
      md: "var(--shadow-md)",
      lg: "var(--shadow-lg)",
      "focus-ring": "var(--focus-ring)",
    },
    fontFamily: {
      sans: "var(--font-family-sans)",
      mono: "var(--font-family-mono)",
    },
    fontSize: {
      xs: ["var(--text-xs)", { lineHeight: "1rem" }],
      sm: ["var(--text-sm)", { lineHeight: "1.25rem" }],
      base: ["var(--text-base)", { lineHeight: "1.5rem" }],
      lg: ["var(--text-lg)", { lineHeight: "1.75rem" }],
      xl: ["var(--text-xl)", { lineHeight: "1.75rem" }],
      "2xl": ["var(--text-2xl)", { lineHeight: "2rem" }],
      "3xl": ["var(--text-3xl)", { lineHeight: "2.25rem" }],
      "4xl": ["var(--text-4xl)", { lineHeight: "2.5rem" }],
    },
    fontWeight: {
      normal: "var(--font-weight-normal)",
      medium: "var(--font-weight-medium)",
      semibold: "var(--font-weight-semibold)",
      bold: "var(--font-weight-bold)",
    },
    transitionDuration: {
      fast: "var(--transition-fast)",
      DEFAULT: "var(--transition-base)",
      slow: "var(--transition-slow)",
    },
    extend: {
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "slide-out": "slideOut 0.3s ease-in",
        "scale-in": "scaleIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        fadeOut: { "0%": { opacity: "1" }, "100%": { opacity: "0" } },
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideOut: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      backdropBlur: {
        sm: "blur(4px)",
        md: "blur(8px)",
        lg: "blur(12px)",
        xl: "blur(16px)",
      },
      cursor: {
        "not-allowed": "not-allowed",
      },
    },
  },
  plugins: [],
};
