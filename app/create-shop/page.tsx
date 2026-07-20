import { CreateShopForm } from "@/features/saas/create-shop-form";
import { PageBackground } from "@/components/layout/page-background";

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
