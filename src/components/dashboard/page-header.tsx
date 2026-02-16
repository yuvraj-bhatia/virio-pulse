import { Sparkles } from "lucide-react";

export function PageHeader({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="mb-5 flex flex-col gap-2">
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dcb26866] bg-[linear-gradient(180deg,rgba(220,178,104,0.22),rgba(220,178,104,0.08))] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
        <Sparkles className="h-3.5 w-3.5 text-[#e5c282]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e5c282]">Pulse</span>
      </div>
      <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-[#f8e6c3] md:text-[2.4rem]">{title}</h1>
      <p className="max-w-3xl text-sm text-muted-foreground md:text-[15px]">{description}</p>
    </div>
  );
}
