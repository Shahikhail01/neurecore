// ─── TwoColumnLayout.tsx ──────────────────────────────────────────────────────
// SRP: Renders a responsive two-column split layout.
// OCP: Slot content via `left` + `right` props — no structural changes needed
//      when panels change.
// Used by: Org Chart page, Agent detail (future), any list+detail pattern.

import { cn } from "@/lib/utils";

interface TwoColumnLayoutProps {
  /** Left column content — data list, sidebar, navigation */
  left: React.ReactNode;
  /** Right column content — detail view, AI panel, chart */
  right: React.ReactNode;
  /**
   * Tailwind width class for the right column.
   * Default: "w-80" (320px). Use "w-96" for wider panels.
   */
  rightWidth?: string;
  className?: string;
}

/**
 * TwoColumnLayout — left (data/list) + right (AI/details) split.
 *
 * The left column fills remaining space; the right column has a fixed width.
 * On small screens the layout stacks vertically.
 */
export function TwoColumnLayout({
  left,
  right,
  rightWidth = "w-80",
  className,
}: TwoColumnLayoutProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden",
        "flex-col md:flex-row",
        className,
      )}
    >
      {/* Left — fills remaining space */}
      <div className="flex-1 overflow-auto min-w-0">{left}</div>

      {/* Right — fixed width */}
      <div
        className={cn(
          "flex-shrink-0 overflow-auto",
          "border-t md:border-t-0 md:border-l border-surface-border",
          rightWidth,
        )}
      >
        {right}
      </div>
    </div>
  );
}
