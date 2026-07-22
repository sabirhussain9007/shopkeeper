"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#0c1f1a] px-4 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-300">Error</p>
        <h1 className="mt-2 text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 max-w-md text-emerald-50/70">{error.message || "An unexpected error occurred."}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-[#0c1f1a] hover:bg-emerald-400"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
