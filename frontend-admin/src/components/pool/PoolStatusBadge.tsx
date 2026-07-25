"use client";

/**
 * PoolStatusBadge — Phase 10.
 * Single source of truth for status pill styling. Maps a string status to
 * a CSS color, regardless of which pool it came from.
 *
 * Solid: SRP — only renders a pill, no other responsibilities.
 */

type Tone = "active" | "draft" | "published" | "archived" | "neutral" | "enabled" | "disabled";

const TONE_CLASSES: Record<Tone, string> = {
  active: "bg-[color:var(--state-success)] text-emerald-300",
  published: "bg-[color:var(--state-success)] text-emerald-300",
  enabled: "bg-[color:var(--state-success)] text-emerald-300",
  draft: "bg-zinc-800 text-zinc-300",
  archived: "bg-zinc-900 text-zinc-500",
  neutral: "bg-zinc-800 text-zinc-300",
  disabled: "bg-[color:var(--state-danger)] text-red-300",
};

function toneFor(status: string | undefined | null): Tone {
  if (!status) return "neutral";
  const s = status.toUpperCase();
  if (s === "ACTIVE" || s === "PUBLISHED" || s === "ENABLED") return "active";
  if (s === "DRAFT") return "draft";
  if (s === "ARCHIVED" || s === "DISABLED") return "disabled";
  return "neutral";
}

export function PoolStatusBadge({
  status,
  label,
}: {
  status?: string | null;
  label?: string;
}) {
  const tone = toneFor(status);
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {label ?? status ?? "—"}
    </span>
  );
}
