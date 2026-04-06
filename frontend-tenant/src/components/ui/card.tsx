import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card Component
 * 
 * A container component for grouped content.
 * Uses design tokens for surface colors and borders.
 * Supports light/dark themes via CSS variables.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface-raised border border-surface-border shadow-md p-lg text-text-primary",
        className,
      )}
      {...props}
    />
  );
}

/**
 * CardHeader Component
 * 
 * Header section of a card, typically containing title and actions.
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-start justify-between mb-lg border-b border-surface-border pb-lg", className)}
      {...props}
    />
  );
}

/**
 * CardTitle Component
 * 
 * Typically used within CardHeader.
 * Displays prominent text.
 */
function CardTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-xl font-semibold text-text-primary", className)}
      {...props}
    />
  );
}

/**
 * CardDescription Component
 * 
 * Secondary text, typically below CardTitle.
 */
function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm text-text-secondary", className)}
      {...props}
    />
  );
}

/**
 * CardContent Component
 * 
 * Main content area of the card.
 */
function CardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("", className)}
      {...props}
    />
  );
}

/**
 * CardFooter Component
 * 
 * Footer section, typically containing actions.
 */
function CardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between mt-lg pt-lg border-t border-surface-border", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
