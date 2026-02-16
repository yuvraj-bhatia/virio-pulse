import { Sparkles } from "lucide-react";

export function PageHeader({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="mb-5 flex flex-col gap-2">
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dcb26866] bg-[#dcb26822] px-3 py-1">
        <Sparkles className="h-3.5 w-3.5 text-[#e5c282]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#e5c282]">Pulse</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-[-0.02em] md:text-3xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
