import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // light, clean base — page + surfaces
        ink: {
          DEFAULT: "#FFFFFF", // page background
          2: "#F5F4F2", // inputs / inset sub-surfaces
          3: "#ECEAE6", // hover / darker inset
          4: "#E2DFDA", // borders
        },
        // dark text on light
        bone: {
          DEFAULT: "#1A1B1E",
          dim: "#585E66",
          faint: "#9CA0A6",
        },
        // Side Kick brand accent (set BRAND_HEX in lib/brand.ts to match site)
        brand: {
          DEFAULT: "#FF6F30",
          deep: "#E85D1E",
          soft: "#FF8A52",
        },
        // alias so existing `gold` utility classes reskin to brand automatically
        gold: {
          DEFAULT: "#FF6F30",
          deep: "#E85D1E",
          soft: "#FF8A52",
        },
        // semantic score scale (deepened for contrast on white)
        good: "#16A34A",
        okk: "#D9831F",
        weak: "#E2622F",
        crit: "#D33A2C",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.22em",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,111,48,0.18), 0 10px 30px -10px rgba(255,111,48,0.40)",
        panel: "0 1px 2px rgba(17,17,17,0.04), 0 16px 40px -24px rgba(17,17,17,0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
