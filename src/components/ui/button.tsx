import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center overflow-hidden whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 ease-virio focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dcb26888] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 before:pointer-events-none before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:translate-x-0 before:bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.32),transparent)] before:opacity-0 before:transition-all before:duration-700 before:ease-float hover:before:translate-x-[260%] hover:before:opacity-100",
  {
    variants: {
      variant: {
        default:
          "border border-[#dcb268aa] bg-[linear-gradient(180deg,rgba(230,191,124,0.96)_0%,rgba(191,148,81,0.92)_100%)] text-[#1b1b18] shadow-[0_10px_30px_rgba(220,178,104,0.35),inset_0_1px_0_rgba(255,255,255,0.38)] hover:-translate-y-[1px] hover:shadow-[0_14px_36px_rgba(220,178,104,0.45),inset_0_1px_0_rgba(255,255,255,0.48)]",
        secondary:
          "border border-[#dcb26850] bg-[linear-gradient(180deg,rgba(18,22,30,0.88)_0%,rgba(14,18,24,0.9)_100%)] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-[#dcb26888] hover:bg-[linear-gradient(180deg,rgba(22,26,34,0.94)_0%,rgba(15,19,25,0.95)_100%)]",
        ghost:
          "border border-transparent bg-transparent text-muted-foreground hover:border-[#dcb26844] hover:bg-[#dcb26818] hover:text-foreground",
        destructive:
          "border border-[#df551f85] bg-[linear-gradient(180deg,rgba(223,85,31,0.92)_0%,rgba(165,66,26,0.88)_100%)] text-[#fff3ed] shadow-[0_10px_24px_rgba(223,85,31,0.25)] hover:-translate-y-[1px]",
        outline:
          "border border-[#dcb26866] bg-[linear-gradient(180deg,rgba(16,20,27,0.64)_0%,rgba(13,17,23,0.74)_100%)] text-[#f4d8ad] hover:border-[#dcb268aa] hover:bg-[#dcb26820]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
