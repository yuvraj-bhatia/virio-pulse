"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const NOTICE_MESSAGES = {
  "workspace-cleared": "Workspace cleared",
  "sample-loaded": "Sample data loaded"
} as const;

type NoticeKey = keyof typeof NOTICE_MESSAGES;

function isNoticeKey(value: string): value is NoticeKey {
  return value in NOTICE_MESSAGES;
}

export function QueryNoticeToast(): JSX.Element | null {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const notice = searchParams.get("notice");
    if (!notice || !isNoticeKey(notice)) {
      return;
    }

    setMessage(NOTICE_MESSAGES[notice]);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("notice");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMessage(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80] rounded-lg border border-[#7f771f99] bg-[#7f771f33] px-4 py-3 text-sm text-[#e3db9d] shadow-xl backdrop-blur">
      {message}
    </div>
  );
}
