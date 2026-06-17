import type { Metadata, Viewport } from "next";
// Self-hosted fonts via @fontsource (no build- or runtime-time network fetch).
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coldscore — by Side Kick",
  description:
    "See your cold email the way your prospect does. Paste an email, get a deep diagnostic scored from your ICP's point of view.",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0e0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
