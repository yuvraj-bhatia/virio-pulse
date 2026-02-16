import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[92px] w-full rounded-lg border border-border bg-input/70 px-3 py-2 text-sm text-foreground ring-offset-background transition-all duration-300 ease-virio placeholder:text-muted-foreground focus-visible:border-[#dcb26888] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dcb26855] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
