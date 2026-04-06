/**
 * Hero Section Component
 *
 * A prominent full-width banner for the home screen.
 * Displays greeting, time, and centered command input.
 * Inspired by Creatio's hero design with scenic background.
 *
 * Features:
 * - Responsive background (gradient or image)
 * - Centered greeting and command input
 * - Optional call-to-action buttons
 * - Accessible text with proper contrast
 * - Light/dark theme support
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface HeroSectionProps {
  /**
   * User's first name for personalized greeting
   */
  userName?: string;

  /**
   * Placeholder text for the command input
   */
  placeholder?: string;

  /**
   * Callback when user enters text in command input
   */
  onCommandSubmit?: (command: string) => void;

  /**
   * Background image URL (optional)
   */
  backgroundImage?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Child content (for custom layouts)
   */
  children?: React.ReactNode;
}

/**
 * HeroSection Component
 *
 * @example
 * <HeroSection
 *   userName="John"
 *   placeholder="Message NeureCore or ask a question..."
 *   onCommandSubmit={(cmd) => console.log(cmd)}
 * />
 */
export function HeroSection({
  userName,
  placeholder = "Message NeureCore or ask a question...",
  onCommandSubmit,
  backgroundImage,
  className,
  children,
}: HeroSectionProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [currentTime, setCurrentTime] = React.useState(new Date());

  // Update time every minute
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onCommandSubmit?.(inputValue);
      setInputValue("");
    }
  };

  const dayOfWeek = format(currentTime, "EEEE");
  const time = format(currentTime, "h:mm aaa");
  const greeting = getGreeting(currentTime.getHours());

  return (
    <section
      className={cn(
        "relative w-full h-64 md:h-80 overflow-hidden rounded-lg",
        className,
      )}
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-accent-600 via-accent-primary to-accent-50"
        style={
          backgroundImage
            ? {
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {/* Overlay for text contrast */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center px-4 py-8">
        {/* Greeting and Time */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {greeting}, {userName || "there"}!
          </h1>
          <p className="text-white/80 text-sm md:text-base">
            {dayOfWeek}, {format(currentTime, "MMMM d, yyyy")} • {time}
          </p>
        </div>

        {/* Command Input */}
        <form onSubmit={handleSubmit} className="w-full max-w-xl px-4 mb-6">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className={cn(
                "w-full px-6 py-3 md:py-4 rounded-lg",
                "bg-white text-text-primary placeholder:text-text-muted",
                "border border-surface-border shadow-lg",
                "transition-all duration-base",
                "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2",
                "text-base md:text-lg",
              )}
              aria-label="Command input"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className={cn(
                "absolute right-2 top-1/2 transform -translate-y-1/2",
                "w-10 h-10 md:w-12 md:h-12",
                "flex items-center justify-center rounded-md",
                "bg-accent-primary text-white",
                "hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors duration-base",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white",
              )}
              title="Send message"
            >
              <span className="text-xl">→</span>
            </button>
          </div>
        </form>

        {/* Custom children (additional content) */}
        {children}
      </div>
    </section>
  );
}

/**
 * Get greeting based on time of day
 */
function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Hello";
}

export type { HeroSectionProps };
