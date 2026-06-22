// ─────────────────────────────────────────────────────────────
// Side Kick brand — single source of truth.
// To match get-sidekick.com exactly, set BRAND_HEX to the site's
// primary accent colour (and update tailwind.config.ts `brand` to match).
// ─────────────────────────────────────────────────────────────

export const BRAND = {
  product: "Coldscore",
  company: "Side Kick",
  tagline: "Read your cold email the way your prospect does.",
  signoff: "Give your SDRs a Side Kick.",
  site: "https://get-sidekick.com",
  bookACall: "https://get-sidekick.com/demo#demopage",
  supportEmail: "support@get-sidekick.com",
};

// Primary accent. Change this one value (and the matching token in
// tailwind.config.ts) to re-skin the whole app to the exact brand colour.
export const BRAND_HEX = "#FF6F30";
