import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";
import { PwaRegister } from "@/components/PwaRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Sora gives headings/titles some personality that Geist alone doesn't —
// a friendlier, more distinctive geometric sans, fitting for a product
// about agents with names and moods rather than a generic dashboard.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cubicle",
  description: "Self-hosted AI office. Watch your agents work.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden">
        <PwaRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
