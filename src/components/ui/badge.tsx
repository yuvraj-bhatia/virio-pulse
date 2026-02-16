import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#dcb26866] bg-[#dcb26824] text-[#f3d5a6]",
        secondary: "border-[#5f7a7e66] bg-[#3a6e7426] text-[#9bc9d0]",
        destructive: "border-[#df551f80] bg-[#df551f2a] text-[#ffb499]",
        outline: "border-border text-foreground",
        success: "border-[#7f771f80] bg-[#7f771f30] text-[#d8d093]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
