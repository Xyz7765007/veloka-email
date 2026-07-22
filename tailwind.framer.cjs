/** CLI-only Tailwind config for compiling the Framer component's CSS.
 *  Mirrors tailwind.config.ts theme; adds framer/ to the content scan. */
module.exports = {
  // Scope + specificity: every utility becomes `.cs-root .util`, so utilities
  // never leak onto the Framer page and always out-specify the scoped reset.
  important: ".cs-root",
  // Preflight is replaced by a scoped reset in framer/_input.css.
  corePlugins: { preflight: false },
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./framer/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#FFFFFF", 2: "#F5F4F2", 3: "#ECEAE6", 4: "#E2DFDA" },
        bone: { DEFAULT: "#1A1B1E", dim: "#585E66", faint: "#9CA0A6" },
        brand: { DEFAULT: "#FF6F30", deep: "#E85D1E", soft: "#FF8A52" },
        gold: { DEFAULT: "#FF6F30", deep: "#E85D1E", soft: "#FF8A52" },
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
      letterSpacing: { eyebrow: "0.22em" },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,111,48,0.18), 0 10px 30px -10px rgba(255,111,48,0.40)",
        panel: "0 1px 2px rgba(17,17,17,0.04), 0 16px 40px -24px rgba(17,17,17,0.16)",
      },
    },
  },
  plugins: [],
};
