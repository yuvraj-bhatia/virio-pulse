import type { Metadata } from "next";
import { Suspense } from "react";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Pulse | Virio Pipeline Attribution Console",
  description: "Internal content-to-revenue attribution console for Virio-style GTM teams"
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <Suspense>{children}</Suspense>
      </body>
    </html>
  );
}
