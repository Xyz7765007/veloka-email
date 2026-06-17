import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // warm "ink" base — deliberately warm, not a cold near-black
        ink: {
          DEFAULT: "#0F0E0B",
          2: "#17150F",
          3: "#211D15",
          4: "#2C271C",
        },
        bone: {
          DEFAULT: "#F1EADC",
          dim: "#A89E8B",
          faint: "#6C6353",
        },
        // signature accent — sodium / spotlight gold (outside the score scale)
        gold: {
          DEFAULT: "#F5C451",
          deep: "#D9A436",
          soft: "#F7D481",
        },
        // semantic score scale
        good: "#5FC98A",
        okk: "#E8983A",
        weak: "#E66B47",
        crit: "#E04A3C",
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
        glow: "0 0 0 1px rgba(245,196,81,0.18), 0 0 40px -8px rgba(245,196,81,0.35)",
        panel: "0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 60px -30px rgba(0,0,0,0.8)",
      },
    },
  },
  plugins: [],
};

export default config;
