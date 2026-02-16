import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-xl border border-[#dcb26844] bg-[linear-gradient(180deg,rgba(14,18,25,0.9),rgba(12,16,22,0.92))] px-3 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-offset-background transition-all duration-300 ease-virio file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground hover:border-[#dcb26870] focus-visible:border-[#dcb268aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dcb26855] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
