import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";
import { PwaRegister } from "@/components/PwaRegister";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cubicle",
  description: "Self-hosted AI office. Watch your agents work.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  // Matches globals.css's --background exactly (warm paper / warm charcoal,
  // not the old cool slate) — this is what tints the mobile browser's own
  // address-bar chrome and the PWA splash screen, so a stale value here
  // shows as a visible seam around the app's actual background the instant
  // it loads.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfaf3" },
    { media: "(prefers-color-scheme: dark)", color: "#19120b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden">
        <PwaRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
