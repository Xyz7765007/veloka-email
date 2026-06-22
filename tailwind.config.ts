import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // cool, clean B2B dark base
        ink: {
          DEFAULT: "#0B0D12",
          2: "#11141B",
          3: "#1A1E27",
          4: "#242A36",
        },
        bone: {
          DEFAULT: "#EDF1F7",
          dim: "#99A2B2",
          faint: "#5C6675",
        },
        // Side Kick brand accent (set BRAND_HEX in lib/brand.ts to match site)
        brand: {
          DEFAULT: "#3D7BFF",
          deep: "#2E5FD0",
          soft: "#7CA6FF",
        },
        // alias so existing `gold` utility classes reskin to brand automatically
        gold: {
          DEFAULT: "#3D7BFF",
          deep: "#2E5FD0",
          soft: "#7CA6FF",
        },
        // semantic score scale
        good: "#48C78E",
        okk: "#E8983A",
        weak: "#E66B47",
        crit: "#E0524A",
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
        glow: "0 0 0 1px rgba(61,123,255,0.18), 0 0 40px -8px rgba(61,123,255,0.38)",
        panel: "0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 60px -30px rgba(0,0,0,0.8)",
      },
    },
  },
  plugins: [],
};

export default config;
