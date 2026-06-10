import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-[opacity,box-shadow,background,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(47,191,113,0.30)] hover:opacity-90",
        destructive:
          "bg-destructive text-white shadow-[0_4px_14px_rgba(220,38,38,0.25)] hover:opacity-90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background text-foreground hover:bg-muted dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-muted dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        /** Pill variant — matches mobile HeaderPillButton accent style */
        pill:
          "rounded-full bg-primary/10 border border-primary/30 text-primary hover:opacity-75",
        "pill-danger":
          "rounded-full bg-destructive/10 border border-destructive/30 text-destructive hover:opacity-75",
        "pill-muted":
          "rounded-full bg-muted border border-border text-muted-foreground hover:opacity-75",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm:      "h-8 rounded-[8px] gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg:      "h-11 rounded-[14px] px-6 text-base has-[>svg]:px-4",
        icon:    "size-9",
        pill:    "h-[34px] px-[14px] py-2 text-[0.8125rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
