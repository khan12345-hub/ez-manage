import type { Metadata } from "next";
import "./globals.css";
import { Figtree, Poppins, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import Providers from "@/providers/providers";

// Body / UI font everywhere
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-figtree",
  display: "swap",
});

// Board name, group name, workspace name titles only
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
