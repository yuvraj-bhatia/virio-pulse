import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="glass-card flex min-h-44 flex-col items-center justify-center rounded-2xl border-dashed border-[#dcb2684a] p-8 text-center">
      <div className="mb-3 rounded-full border border-[#dcb2685f] bg-[#dcb2681a] p-2.5">
        <Inbox className="h-5 w-5 text-[#e5c282]" />
      </div>
      <h3 className="text-sm font-semibold text-[#f2dfbc]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
