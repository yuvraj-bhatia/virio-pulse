"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }): JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card max-w-lg space-y-4 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">Pulse hit an unexpected error. Try reloading this view.</p>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
