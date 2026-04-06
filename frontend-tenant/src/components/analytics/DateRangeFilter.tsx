/**
 * Date Range Filter Component - Phase 6
 *
 * Reusable date range selector for analytics filtering.
 * Supports preset ranges (Last 7 days, Last 30 days, Last 90 days, Custom).
 *
 * Features:
 * - Preset quick-select buttons
 * - Date picker for custom ranges
 * - Mobile-responsive
 * - Accessibility support
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Calendar, ChevronDown } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

interface DateRangeFilterProps {
  /**
   * Callback when date range changes
   */
  onDateRangeChange: (from: Date, to: Date) => void;

  /**
   * Current date range
   */
  currentFrom?: Date;
  currentTo?: Date;

  /**
   * Optional label
   */
  label?: string;

  /**
   * Optional CSS class
   */
  className?: string;
}

type PresetType = "7d" | "30d" | "90d" | "custom";

/**
 * Date Range Filter Component
 *
 * Allows users to quickly select date ranges for analytics filtering.
 * Includes preset buttons and custom date picker option.
 *
 * @example
 * <DateRangeFilter
 *   onDateRangeChange={handleDateChange}
 *   currentFrom={filterFrom}
 *   currentTo={filterTo}
 *   label="Date Range"
 * />
 */
export function DateRangeFilter({
  onDateRangeChange,
  currentFrom,
  currentTo,
  label = "Date Range",
  className = "",
}: DateRangeFilterProps) {
  const [preset, setPreset] = React.useState<PresetType>("30d");
  const [showCustom, setShowCustom] = React.useState(false);
  const [fromInput, setFromInput] = React.useState(
    currentFrom ? format(currentFrom, "yyyy-MM-dd") : "",
  );
  const [toInput, setToInput] = React.useState(
    currentTo ? format(currentTo, "yyyy-MM-dd") : "",
  );

  const handlePresetClick = (presetType: PresetType) => {
    const now = new Date();
    let from: Date;
    const to = now;

    switch (presetType) {
      case "7d":
        from = subDays(now, 7);
        break;
      case "30d":
        from = subDays(now, 30);
        break;
      case "90d":
        from = subDays(now, 90);
        break;
      case "custom":
        setShowCustom(true);
        return;
      default:
        from = subDays(now, 30);
    }

    setPreset(presetType);
    setShowCustom(false);
    onDateRangeChange(from, to);
  };

  const handleCustomApply = () => {
    if (!fromInput || !toInput) return;
    try {
      const from = new Date(fromInput);
      const to = new Date(toInput);
      if (from > to) {
        alert("Start date must be before end date");
        return;
      }
      setPreset("custom");
      onDateRangeChange(from, to);
      setShowCustom(false);
    } catch {
      alert("Invalid date format");
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-semibold text-text-primary">
          {label}
        </label>
      )}

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "7d" as const, label: "Last 7 days" },
          { key: "30d" as const, label: "Last 30 days" },
          { key: "90d" as const, label: "Last 90 days" },
          { key: "custom" as const, label: "Custom" },
        ].map((option) => (
          <button
            key={option.key}
            onClick={() => handlePresetClick(option.key)}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-lg",
              "transition-colors duration-base border",
              preset === option.key
                ? "bg-accent-primary text-white border-accent-primary"
                : "border-surface-border bg-surface-base text-text-primary hover:bg-surface-overlay",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Custom Date Picker */}
      {showCustom && (
        <div className="p-3 rounded-lg bg-surface-overlay border border-surface-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                From
              </label>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 text-sm rounded-lg border",
                  "bg-surface-base text-text-primary placeholder-text-muted",
                  "border-surface-border focus:border-accent-primary",
                  "focus:ring-2 focus:ring-accent-primary focus:ring-opacity-10",
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                To
              </label>
              <input
                type="date"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 text-sm rounded-lg border",
                  "bg-surface-base text-text-primary placeholder-text-muted",
                  "border-surface-border focus:border-accent-primary",
                  "focus:ring-2 focus:ring-accent-primary focus:ring-opacity-10",
                )}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCustom(false)}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-medium rounded-lg",
                "border border-surface-border bg-surface-base text-text-primary",
                "hover:bg-surface-overlay transition-colors",
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleCustomApply}
              disabled={!fromInput || !toInput}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-semibold rounded-lg",
                "text-white bg-accent-primary hover:bg-accent-primary/90",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Current Range Display */}
      {currentFrom && currentTo && !showCustom && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            "bg-surface-overlay border border-surface-border",
            "text-xs text-text-secondary",
          )}
        >
          <Calendar className="w-4 h-4" />
          <span>
            {format(currentFrom, "MMM dd")} –{" "}
            {format(currentTo, "MMM dd, yyyy")}
          </span>
        </div>
      )}
    </div>
  );
}

export type { DateRangeFilterProps };
