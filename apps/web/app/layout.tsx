import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import { cn } from "@/lib/utils";
import Providers from "@/providers/providers";

/*
 * EZ Manage "Ledger" type system.
 *   UI + titles  → the device's own UI font (Segoe UI on Windows, SF on Mac,
 *                  Roboto on Android) via --font-figtree / --font-poppins in
 *                  globals.css — crisp at small sizes, nothing to download
 *   --font-mono-display  → numbers, labels (IBM Plex Mono)
 *   --font-serif-display → big headings only (Instrument Serif)
 */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono-display",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EZ Manage",
  description: "Boards, Work and the CEO Tower for every company you run.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(plexMono.variable, instrumentSerif.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
