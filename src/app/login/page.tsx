"use client";

import { LockKeyhole, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DEMO_AUTH_KEY } from "@/components/providers/auth-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent): void => {
    event.preventDefault();

    if (code.trim().toLowerCase() !== "pulse") {
      setError("Use demo code: pulse");
      return;
    }

    localStorage.setItem(DEMO_AUTH_KEY, "true");
    router.push("/overview");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(220,178,104,0.25),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(58,110,116,0.35),transparent_38%)]" />
      <Card className="relative z-10 w-full max-w-md">
        <CardHeader>
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[#dcb26866] bg-[#dcb26821] px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-[#e5c282]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#e0be85]">Pulse Demo</span>
          </div>
          <CardTitle className="text-3xl tracking-[-0.03em]">Virio Pipeline Attribution Console</CardTitle>
          <CardDescription>Secure demo access for internal stakeholders.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Demo access code</label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Enter code"
                autoComplete="off"
              />
              {error ? <p className="text-sm text-[#ffb499]">{error}</p> : null}
            </div>
            <Button className="w-full" type="submit">
              <LockKeyhole className="mr-2 h-4 w-4" />
              Enter Console
            </Button>
            <p className="text-xs text-muted-foreground">For this demo use code: <span className="font-mono">pulse</span></p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
