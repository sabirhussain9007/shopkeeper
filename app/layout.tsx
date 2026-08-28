// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, DM_Sans } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import { openGraphBase, siteConfig, siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const landingDisplay = Fraunces({
  variable: "--font-landing-display",
  subsets: ["latin"],
});

const landingSans = DM_Sans({
  variable: "--font-landing-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // No `alternates.canonical` here on purpose: a root canonical is inherited by
  // every segment that does not override it, which would point every page at "/".
  // Indexable pages declare their own self-referencing canonical instead.
  openGraph: {
    ...openGraphBase,
    title: siteConfig.title,
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-PK"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${landingDisplay.variable} ${landingSans.variable} h-full antialiased`}
    >
      <body
        className="min-h-full overflow-x-hidden font-[family-name:var(--font-landing-sans)]"
        suppressHydrationWarning
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
