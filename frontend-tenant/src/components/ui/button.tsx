import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

/**
 * Button variant styles using design tokens
 * Primary: Accent colors for main CTAs
 * Secondary: Surface colors for alternative actions
 * Danger: Status danger color for destructive actions
 * Ghost: Transparent with hover background
 * Link: Text-only with underline on hover
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-base disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-primary text-white hover:bg-accent-hover active:bg-accent-active focus-visible:ring-accent-primary shadow-sm hover:shadow-md",
        secondary:
          "bg-surface-raised text-text-primary border border-surface-border hover:bg-surface-overlay active:bg-surface-border focus-visible:ring-accent-primary shadow-sm hover:shadow-md",
        danger:
          "bg-status-danger text-white hover:bg-status-danger/90 active:bg-status-danger/80 focus-visible:ring-status-danger shadow-sm hover:shadow-md",
        ghost:
          "hover:bg-surface-overlay active:bg-surface-border text-text-primary focus-visible:ring-accent-primary",
        link: "text-accent-primary underline-offset-4 hover:underline focus-visible:ring-accent-primary",
      },
      size: {
        xs: "h-7 px-2.5 text-xs gap-1 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-sm gap-1.5 [&_svg:not([class*='size-'])]:size-3",
        default: "h-9 px-4 text-sm",
        lg: "h-10 px-6 text-base",
        xl: "h-11 px-8 text-base",
        icon: "size-9",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-10 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/** 
 * Button Component
 * 
 * A flexible, accessible button component supporting multiple variants and sizes.
 * Uses design tokens for consistent theming across light/dark modes.
 * 
 * @example
 * <Button>Click me</Button>
 * <Button variant="secondary" size="lg">Secondary Large</Button>
 * <Button variant="danger">Delete</Button>
 * <Button variant="ghost" size="icon"><Icon /></Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "default", asChild = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
