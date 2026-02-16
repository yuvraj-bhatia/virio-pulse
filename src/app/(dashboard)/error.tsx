"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }): JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="glass-card mx-auto max-w-xl rounded-xl p-8 text-center">
      <h2 className="text-2xl font-semibold">Dashboard error</h2>
      <p className="mt-2 text-sm text-muted-foreground">We could not load this dashboard view.</p>
      <Button className="mt-6" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
