import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c1f1a] px-4 text-center text-white">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">404</p>
      <h1 className="mt-2 text-4xl font-semibold">Page not found</h1>
      <p className="mt-3 max-w-md text-emerald-50/70">The page you requested does not exist or was moved.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
