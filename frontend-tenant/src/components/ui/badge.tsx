import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

/**
 * Badge variant styles using design tokens
 *
 * Primary: Accent colors for primary importance
 * Secondary: Surface colors for secondary badges
 * Success: Status green for positive badges
 * Warning: Status orange for warning badges
 * Danger: Status red for error/critical badges
 * Info: Status blue for informational badges
 * Ghost: Subtle background with muted text
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border gap-1.5 px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base transition-colors duration-base",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-50 text-accent-primary border-accent-primary/20 hover:bg-accent-primary/10",
        secondary:
          "bg-surface-overlay text-text-primary border-surface-border hover:bg-surface-overlay/80",
        success:
          "bg-status-success-light text-status-success border-status-success/20 hover:bg-status-success/10",
        warning:
          "bg-status-warning-light text-status-warning border-status-warning/20 hover:bg-status-warning/10",
        danger:
          "bg-status-danger-light text-status-danger border-status-danger/20 hover:bg-status-danger/10",
        info: "bg-status-info-light text-status-info border-status-info/20 hover:bg-status-info/10",
        ghost:
          "text-text-secondary border-surface-border hover:text-text-primary hover:bg-surface-overlay",
        outline:
          "border-surface-border text-text-primary hover:bg-surface-overlay",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

interface BadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

/**
 * Badge Component
 *
 * A small, labeled display component for status, tags, or indicators.
 * Uses design tokens for consistent theming.
 *
 * @example
 * <Badge>New</Badge>
 * <Badge variant="success">Approved</Badge>
 * <Badge variant="danger">Failed</Badge>
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "secondary", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <Comp
        className={cn(badgeVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
export type { BadgeProps };
