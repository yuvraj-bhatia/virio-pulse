import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium text-sm ring-offset-background transition-all duration-300 ease-virio focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-[#e6bf7c] to-[#bf9451] text-[#1b1b18] shadow-[0_8px_30px_rgba(220,178,104,0.4)] hover:translate-y-[-1px] hover:shadow-[0_14px_36px_rgba(220,178,104,0.46)]",
        secondary:
          "bg-muted text-foreground border border-border hover:bg-muted/80 hover:border-[#dcb26866]",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-[#dcb26866] bg-transparent hover:bg-[#dcb2681a] hover:border-[#dcb26899]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
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
