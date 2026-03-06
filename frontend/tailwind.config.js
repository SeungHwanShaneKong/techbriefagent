/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* ── CatchTable-inspired palette ── */
        background: "#FAFAFA",
        panel: "#FFFFFF",
        surface: "#F5F5F7",
        border: "#E5E5EA",
        "border-light": "#F0F0F2",
        primary: "#FF6B35",          /* warm coral-orange */
        "primary-light": "#FFF0E8",
        "primary-dark": "#E55A28",
        accent: "#FF6B35",
        secondary: "#6B7280",
        success: "#34C759",
        warning: "#FF9500",
        danger: "#FF3B30",
        "text-primary": "#1C1C1E",
        "text-secondary": "#8E8E93",
        "text-tertiary": "#AEAEB2",

        /* ── Dark mode overrides (used via dark: prefix) ── */
        dark: {
          background: "#1C1C1E",
          panel: "#2C2C2E",
          surface: "#3A3A3C",
          border: "#48484A",
          "border-light": "#3A3A3C",
          "primary-light": "#3D2518",
          "text-primary": "#F5F5F7",
          "text-secondary": "#AEAEB2",
          "text-tertiary": "#8E8E93",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Noto Sans KR",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        header: "0 1px 0 rgba(0,0,0,0.06)",
        float: "0 8px 30px rgba(0,0,0,0.12)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out forwards",
      },
    },
  },
  plugins: [],
}
