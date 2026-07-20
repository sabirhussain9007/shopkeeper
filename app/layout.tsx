import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, DM_Sans } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const landingDisplay = Fraunces({ variable: "--font-landing-display", subsets: ["latin"] });
const landingSans = DM_Sans({ variable: "--font-landing-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shopkeeper — Retail SaaS",
  description: "Multi-shop retail POS, inventory, ledger, and reporting for Pakistani retailers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${landingDisplay.variable} ${landingSans.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden font-[family-name:var(--font-landing-sans)]" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
