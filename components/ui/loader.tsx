import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoaderSize = "sm" | "md" | "lg";

const sizeMap: Record<LoaderSize, string> = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

type LoaderProps = {
  label?: string;
  size?: LoaderSize;
  className?: string;
  /** Centered block — tables, cards, sections */
  variant?: "inline" | "center" | "page" | "overlay";
};

export function Spinner({ size = "md", className }: { size?: LoaderSize; className?: string }) {
  return <Loader2 className={cn("animate-spin text-emerald-500", sizeMap[size], className)} aria-hidden />;
}

export function Loader({ label, size = "md", className, variant = "center" }: LoaderProps) {
  const spinner = <Spinner size={size} />;

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-2", className)} role="status" aria-live="polite" aria-busy="true">
        {spinner}
        {label ? <span className="text-sm text-zinc-500">{label}</span> : null}
      </span>
    );
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      {spinner}
      {label ? <p className="text-sm text-zinc-500">{label}</p> : null}
    </div>
  );

  if (variant === "overlay") {
    return (
      <div
        className={cn("absolute inset-0 z-10 flex items-center justify-center bg-[#f6f8f5]/80 backdrop-blur-sm", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {content}
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className={cn("flex min-h-[40vh] w-full items-center justify-center py-12", className)} role="status" aria-live="polite" aria-busy="true">
        {content}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full items-center justify-center py-12", className)} role="status" aria-live="polite" aria-busy="true">
      {content}
    </div>
  );
}

/** Full-page / route transition loader */
export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return <Loader label={label} variant="page" size="lg" />;
}

/** Table empty/loading row */
export function TableLoader({ colSpan, label = "Loading..." }: { colSpan: number; label?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8">
        <Loader label={label} variant="center" className="py-4" size="md" />
      </td>
    </tr>
  );
}

/** Card / surface skeleton alternative */
export function BlockLoader({ label = "Loading..." }: { label?: string }) {
  return <Loader label={label} variant="center" />;
}
