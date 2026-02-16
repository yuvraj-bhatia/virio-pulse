"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type ClientOption = {
  id: string;
  name: string;
};

type ActiveClientContextValue = {
  activeClientId: string | null;
  setActiveClientId: (clientId: string) => void;
  clients: ClientOption[];
};

const ActiveClientContext = createContext<ActiveClientContextValue | null>(null);

export function ActiveClientProvider({
  children,
  clients
}: {
  children: React.ReactNode;
  clients: ClientOption[];
}): JSX.Element {
  const searchParams = useSearchParams();
  const fallbackClientId = clients[0]?.id ?? null;
  const urlClientId = searchParams.get("clientId");
  const [activeClientId, setActiveClientId] = useState<string | null>(urlClientId ?? fallbackClientId);

  useEffect(() => {
    setActiveClientId(urlClientId ?? fallbackClientId);
  }, [urlClientId, fallbackClientId]);

  const value = useMemo<ActiveClientContextValue>(
    () => ({
      activeClientId,
      setActiveClientId,
      clients
    }),
    [activeClientId, clients]
  );

  return <ActiveClientContext.Provider value={value}>{children}</ActiveClientContext.Provider>;
}

export function useActiveClient(): ActiveClientContextValue {
  const context = useContext(ActiveClientContext);
  if (!context) {
    throw new Error("useActiveClient must be used within ActiveClientProvider");
  }
  return context;
}
