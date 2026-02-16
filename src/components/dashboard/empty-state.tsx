import { Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="glass-card flex min-h-40 flex-col items-center justify-center rounded-xl border-dashed p-8 text-center">
      <Inbox className="mb-2 h-5 w-5 text-muted-foreground" />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
