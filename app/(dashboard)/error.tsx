"use client";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Surface>
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="mt-2 text-zinc-500">{error.message}</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </Surface>
  );
}
