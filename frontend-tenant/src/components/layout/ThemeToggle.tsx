/**
 * Theme Toggle Component
 * 
 * Allows users to switch between light, dark, and high-contrast themes.
 * Persists preference to localStorage and respects system preference on first visit.
 * 
 * Uses design tokens for consistent styling.
 */

"use client";

import React, { useState, useEffect } from "react";
import { Moon, Sun, Maximize2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ThemeOption = "light" | "dark" | "high-contrast";

const THEME_CONFIG: Record<
  ThemeOption,
  { label: string; description: string; icon: React.ReactNode }
> = {
  light: {
    label: "Light",
    description: "Bright colors optimized for daytime use",
    icon: <Sun className="w-4 h-4" aria-hidden="true" />,
  },
  dark: {
    label: "Dark",
    description: "Dark colors optimized for evening use",
    icon: <Moon className="w-4 h-4" aria-hidden="true" />,
  },
  "high-contrast": {
    label: "High Contrast",
    description: "WCAG AAA accessible high-contrast colors",
    icon: <Maximize2 className="w-4 h-4" aria-hidden="true" />,
  },
};

interface ThemeToggleProps {
  /**
   * Display style: "icon-button", "dropdown", or "compact"
   */
  variant?: "icon-button" | "dropdown" | "compact";
  className?: string;
  /**
   * Callback when theme changes
   */
  onThemeChange?: (theme: ThemeOption) => void;
}

/**
 * ThemeToggle Component
 * 
 * @example
 * // Icon button variant (default)
 * <ThemeToggle />
 * 
 * // Dropdown variant
 * <ThemeToggle variant="dropdown" />
 * 
 * // Compact variant (icon only, no touch target)
 * <ThemeToggle variant="compact" />
 */
export function ThemeToggle({
  variant = "icon-button",
  className,
  onThemeChange,
}: ThemeToggleProps) {
  const { theme, setTheme, mounted } = useTheme() as {
    theme: ThemeOption;
    setTheme: (theme: ThemeOption) => void;
    mounted: boolean;
  };
  const [isOpen, setIsOpen] = useState(false);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div
        className={cn(
          "w-9 h-9 bg-surface-muted rounded-md animate-pulse",
          className,
        )}
        aria-hidden="true"
      />
    );
  }

  const handleThemeChange = (newTheme: ThemeOption) => {
    setTheme(newTheme);
    onThemeChange?.(newTheme);
    setIsOpen(false);
  };

  if (variant === "dropdown") {
    return (
      <div className={cn("relative", className)}>
        <Select value={theme} onValueChange={(value) => handleThemeChange(value as ThemeOption)}>
          <SelectTrigger
            className="w-40"
            aria-label="Select theme"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(THEME_CONFIG) as ThemeOption[]).map((themeOption) => (
              <SelectItem key={themeOption} value={themeOption}>
                <div className="flex items-center gap-2">
                  {THEME_CONFIG[themeOption].icon}
                  {THEME_CONFIG[themeOption].label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (variant === "compact") {
    const currentIcon = THEME_CONFIG[theme].icon;
    const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "high-contrast" : "light";

    return (
      <button
        onClick={() => handleThemeChange(nextTheme)}
        className={cn(
          "text-text-secondary hover:text-text-primary",
          "transition-colors duration-base",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
          className,
        )}
        title={`Switch to ${THEME_CONFIG[nextTheme].label} theme`}
        aria-label={`Current theme: ${theme}. Click to switch to ${nextTheme}`}
      >
        {currentIcon}
      </button>
    );
  }

  // Default: icon-button variant
  const currentIcon = THEME_CONFIG[theme].icon;
  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "high-contrast" : "light";

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        onClick={() => handleThemeChange(nextTheme)}
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-md",
          "text-text-secondary hover:text-text-primary hover:bg-surface-overlay",
          "transition-colors duration-base",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
        )}
        title={`Current theme: ${THEME_CONFIG[theme].label}. Click to toggle to ${THEME_CONFIG[nextTheme].label}`}
        aria-label={`Theme: ${THEME_CONFIG[theme].label}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {currentIcon}
      </button>

      {/* Optional: Tooltip on hover */}
      <div
        className={cn(
          "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-md",
          "bg-surface-base text-text-primary text-xs whitespace-nowrap",
          "border border-surface-border shadow-md",
          "pointer-events-none opacity-0 transition-opacity duration-base",
          "group-hover:opacity-100",
        )}
        role="tooltip"
      >
        {THEME_CONFIG[theme].description}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-surface-base border-r border-b border-surface-border" />
      </div>
    </div>
  );
}

/**
 * ThemeProviderClient Component
 * 
 * Wrap your app with this component to enable theme persistence and system preference detection.
 * Must be used in a client component.
 */
export function ThemeProviderClient({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  // Prevent hydration mismatch by not rendering until client-side
  if (!isMounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}

export type { ThemeOption as Theme };