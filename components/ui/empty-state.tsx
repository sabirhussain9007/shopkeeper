import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, className }: { title: string; description?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center", className)}>
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
        <Inbox className="h-6 w-6" />
      </span>
      <p className="font-medium text-zinc-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-zinc-200/70", className)} />;
}
