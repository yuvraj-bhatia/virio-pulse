import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="text-4xl font-semibold tracking-tight">Route not found</h1>
      <p className="text-muted-foreground">Pulse could not locate this page.</p>
      <Button asChild>
        <Link href="/overview">Back to Overview</Link>
      </Button>
    </main>
  );
}
