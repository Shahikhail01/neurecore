import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input Component
 *
 * A flexible text input component supporting various types.
 * Uses design tokens for consistent theming across light/dark modes.
 * Includes proper focus states and accessibility features.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles - using design tokens
          "w-full rounded-md border bg-surface-base text-text-primary placeholder:text-text-muted",
          "h-9 px-3 py-2 text-sm",
          "border-surface-border transition-colors duration-base shadow-sm",

          // Focus states
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",

          // Hover state
          "hover:border-surface-border/80",

          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted",

          // Read-only state
          "read-only:bg-surface-muted read-only:cursor-pointer",

          // Invalid/error state
          "aria-invalid:border-status-danger aria-invalid:focus-visible:ring-status-danger",

          // File input styling
          "file:rounded-sm file:border-0 file:bg-surface-raised file:px-2 file:py-1.5 file:text-sm file:font-medium file:text-text-primary file:cursor-pointer hover:file:bg-surface-border",

          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
