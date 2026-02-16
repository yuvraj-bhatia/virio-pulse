import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-all duration-300 ease-virio",
  {
    variants: {
      variant: {
        default:
          "border-[#dcb26888] bg-[linear-gradient(180deg,rgba(220,178,104,0.28),rgba(220,178,104,0.16))] text-[#f3d5a6]",
        secondary:
          "border-[#5f7a7e70] bg-[linear-gradient(180deg,rgba(58,110,116,0.32),rgba(58,110,116,0.16))] text-[#9bc9d0]",
        destructive:
          "border-[#df551f85] bg-[linear-gradient(180deg,rgba(223,85,31,0.32),rgba(223,85,31,0.14))] text-[#ffb499]",
        outline: "border-[#dcb26844] bg-transparent text-[#d8d7d0]",
        success:
          "border-[#7f771f85] bg-[linear-gradient(180deg,rgba(127,119,31,0.34),rgba(127,119,31,0.16))] text-[#d8d093]"
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
