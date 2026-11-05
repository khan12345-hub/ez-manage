import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import Providers from "@/providers/providers";

// Body / UI font everywhere — Plus Jakarta Sans (keeps the --font-figtree var
// name so every existing style picks it up with zero other changes)
const figtree = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

// Titles (.font-title) — same family, heavier weights (keeps --font-poppins var)
const poppins = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

// CEO dashboard KPI numbers — data-terminal feel
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-mono-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EzManage",
  description: "Task Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(figtree.variable, poppins.variable, jetbrainsMono.variable)}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
