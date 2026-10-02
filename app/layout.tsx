import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seed Studio — Trova il tuo mondo Minecraft",
  description: "Componi i tuoi criteri, cerca seed Minecraft Java e scopri la mappa interattiva dei biomi.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
