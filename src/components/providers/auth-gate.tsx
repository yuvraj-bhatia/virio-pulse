"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const DEMO_AUTH_KEY = "pulse_demo_auth";

export function AuthGate({ children }: { children: React.ReactNode }): JSX.Element {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const isAuthorized = typeof window !== "undefined" && localStorage.getItem(DEMO_AUTH_KEY) === "true";
    if (!isAuthorized) {
      router.replace("/login");
      return;
    }
    setIsReady(true);
  }, [router]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-card w-full max-w-xl space-y-3 rounded-xl p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export { DEMO_AUTH_KEY };
