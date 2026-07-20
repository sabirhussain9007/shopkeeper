import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const gradientStyle = {
  background:
    "radial-gradient(ellipse 80% 50% at 15% 0%, rgba(52,211,153,0.22), transparent 50%), radial-gradient(ellipse 55% 40% at 90% 10%, rgba(250,204,21,0.12), transparent 45%), linear-gradient(180deg, #0c1f1a 0%, #123029 50%, #0a1814 100%)",
};

const patternStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
};

type PageBackgroundProps = {
  className?: string;
  fixed?: boolean;
};

export function PageBackground({ className, fixed = true }: PageBackgroundProps) {
  const position = fixed ? "fixed" : "absolute";

  return (
    <>
      <div className={cn(position, "inset-0 -z-10 bg-[#0c1f1a]", className)} aria-hidden />
      <div className={cn(position, "inset-0 -z-10", className)} style={gradientStyle} aria-hidden />
      <div className={cn(position, "inset-0 -z-10 opacity-[0.08]", className)} style={patternStyle} aria-hidden />
    </>
  );
}

/** Light content panel — matches login form section contrast */
export function AppPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[2rem] border border-zinc-200/90 bg-[var(--panel)] text-zinc-950 shadow-2xl shadow-emerald-950/25",
        className,
      )}
      {...props}
    />
  );
}
