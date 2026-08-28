import type { Metadata } from "next";
import { openGraphBase } from "@/lib/site";
import { CreateShopForm } from "@/features/saas/create-shop-form";
import { PageBackground } from "@/components/layout/page-background";

export const metadata: Metadata = {
  title: "Create your shop",
  description:
    "Set up your Shopkeeper account in minutes — pick a monthly or yearly plan and pay with EasyPaisa, JazzCash, or bank transfer.",
  alternates: {
    canonical: "/create-shop",
  },
  openGraph: {
    ...openGraphBase,
    title: "Create your shop | Shopkeeper",
    description:
      "Set up your Shopkeeper account in minutes — pick a monthly or yearly plan and pay with EasyPaisa, JazzCash, or bank transfer.",
    url: "/create-shop",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create your shop | Shopkeeper",
    description:
      "Set up your Shopkeeper account in minutes — pick a monthly or yearly plan and pay with EasyPaisa, JazzCash, or bank transfer.",
  },
};

export default function CreateShopPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 md:px-8 md:py-14">
      <PageBackground />
      <div className="relative">
        <CreateShopForm />
      </div>
    </main>
  );
}
