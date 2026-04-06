// ─── lib/markdown.ts ─────────────────────────────────────────────────────────
// XSS-safe markdown-to-HTML renderer.
//
// Security strategy:
//   1. Escape ALL raw HTML entities first (prevents tag injection).
//   2. Then apply known-safe markdown transforms that insert trusted tags only.
//   3. Callers use `dangerouslySetInnerHTML` — but the content is sanitized here.
//
// SRP: this module owns markdown rendering only.
// OCP: add transform rules without touching callers.

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts a markdown string to a safe HTML string.
 * The input is HTML-escaped first, then markdown patterns are applied.
 */
export function renderMarkdown(content: string): string {
  const escaped = escapeHtml(content);

  return (
    escaped
      // Headings (h4-h6 collapsed into one style)
      .replace(
        /^#{4,6} (.+)$/gm,
        "<h5 class='text-caption font-semibold mt-3 mb-1 text-text-primary'>$1</h5>",
      )
      .replace(
        /^### (.+)$/gm,
        "<h4 class='text-body font-semibold mt-3 mb-1 text-text-primary'>$1</h4>",
      )
      .replace(
        /^## (.+)$/gm,
        "<h3 class='text-subheading font-semibold mt-4 mb-1 text-text-primary'>$1</h3>",
      )
      .replace(
        /^# (.+)$/gm,
        "<h2 class='text-heading font-bold mt-4 mb-2 text-text-primary'>$1</h2>",
      )
      // Bold & italic
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/__(.+?)__/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      // Inline code — uses surface-overlay token class
      .replace(
        /`(.+?)`/g,
        "<code class='bg-surface-overlay px-1 rounded text-caption font-mono text-brand-dim'>$1</code>",
      )
      // Unordered list items
      .replace(
        /^[*-] (.+)$/gm,
        "<li class='ml-4 list-disc text-text-secondary'>$1</li>",
      )
      .replace(
        /(<li[^>]*>.*<\/li>\n?)+/g,
        "<ul class='my-1 space-y-0.5'>$&</ul>",
      )
      // Paragraph breaks and line breaks
      .replace(/\n\n/g, "<p class='my-2'></p>")
      .replace(/\n/g, "<br/>")
  );
}
