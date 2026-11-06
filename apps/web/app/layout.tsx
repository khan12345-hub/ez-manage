import type { Metadata } from "next";
import "./globals.css";
import {
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Bricolage_Grotesque,
  Instrument_Serif,
} from "next/font/google";
import { cn } from "@/lib/utils";
import Providers from "@/providers/providers";

/*
 * EZ Manage "Ledger" type system (Phase 0 design tokens).
 * The CSS variable names are kept from the previous fonts so every existing
 * style picks up the new faces with no other changes:
 *   --font-figtree       → body / UI       (IBM Plex Sans)
 *   --font-poppins       → titles          (Bricolage Grotesque, .font-title)
 *   --font-mono-display  → numbers, labels (IBM Plex Mono)
 *   --font-serif-display → luxury headlines on login / home / CEO (Instrument Serif)
 */
const figtree = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

const poppins = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

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
    <html
      lang="en"
      className={cn(
        figtree.variable,
        poppins.variable,
        plexMono.variable,
        instrumentSerif.variable,
      )}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
