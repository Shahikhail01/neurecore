"use client";

/**
 * ArtifactViewer — Phase 3.2
 * Renders agent task output based on detected MIME type.
 * Supports: markdown, CSV table, JSON, PDF embed, images.
 */

import { useMemo, useState } from "react";
import {
  FileText,
  Table2,
  Braces,
  FileImage,
  File,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtifactViewerProps {
  content: string;
  mimeType?: string;
  filename?: string;
  className?: string;
}

type DetectedType = "markdown" | "csv" | "json" | "pdf" | "image" | "plain";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectType(
  content: string,
  mimeType?: string,
  filename?: string,
): DetectedType {
  const mime = mimeType?.toLowerCase() ?? "";
  const ext = filename?.split(".").pop()?.toLowerCase() ?? "";

  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
  )
    return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime === "application/json" || ext === "json") return "json";
  if (mime === "text/csv" || ext === "csv") return "csv";
  if (mime === "text/markdown" || ["md", "markdown"].includes(ext))
    return "markdown";

  // Heuristic detection from content
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.includes("\n") && trimmed.split("\n")[0].split(",").length >= 3) {
    const lines = trimmed.split("\n").slice(0, 5);
    const colCounts = lines.map((l) => l.split(",").length);
    if (colCounts.every((c) => c === colCounts[0])) return "csv";
  }
  if (/^#{1,6} |^[*-] |\*\*|__/.test(trimmed)) return "markdown";

  return "plain";
}

function parseCsv(
  raw: string,
  maxRows = 50,
): { headers: string[]; rows: string[][] } {
  const lines = raw
    .trim()
    .split("\n")
    .slice(0, maxRows + 1);
  const parse = (line: string) =>
    line.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim());
  const [header, ...data] = lines;
  return { headers: parse(header), rows: data.map(parse) };
}

function renderMarkdown(content: string): string {
  return content
    .replace(
      /^#{4,6} (.+)$/gm,
      "<h5 class='text-xs font-semibold mt-3 mb-1'>$1</h5>",
    )
    .replace(
      /^### (.+)$/gm,
      "<h4 class='text-sm font-semibold mt-3 mb-1'>$1</h4>",
    )
    .replace(
      /^## (.+)$/gm,
      "<h3 class='text-base font-semibold mt-4 mb-1'>$1</h3>",
    )
    .replace(/^# (.+)$/gm, "<h2 class='text-lg font-bold mt-4 mb-2'>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(
      /`(.+?)`/g,
      "<code class='bg-zinc-800 px-1 rounded text-xs font-mono'>$1</code>",
    )
    .replace(/^[*-] (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/(<li.*<\/li>\n?)+/g, "<ul class='my-1 space-y-0.5'>$&</ul>")
    .replace(/\n\n/g, "<p class='my-2'></p>")
    .replace(/\n/g, "<br/>");
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function JsonViewer({ content }: { content: string }) {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <pre className="text-xs font-mono overflow-auto text-emerald-300 leading-relaxed whitespace-pre-wrap break-words">
      {formatted}
    </pre>
  );
}

function CsvViewer({ content }: { content: string }) {
  const { headers, rows } = useMemo(() => parseCsv(content), [content]);

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="sticky top-0 px-3 py-1.5 text-left font-medium text-[var(--text-secondary)] bg-[var(--surface-overlay)] border-b border-[var(--surface-border)] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? "bg-transparent" : "bg-zinc-800/20"}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-1 text-[var(--text-primary)] border-b border-[var(--surface-border)]/40 truncate max-w-xs"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownViewer({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div
      className="text-sm text-[var(--text-primary)] leading-relaxed prose-sm"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PdfViewer({ content }: { content: string }) {
  const blobUrl = useMemo(() => {
    try {
      const bytes = atob(content);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      return URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
    } catch {
      return null;
    }
  }, [content]);

  if (!blobUrl)
    return <p className="text-xs text-red-400">Unable to render PDF.</p>;
  return (
    <embed
      src={blobUrl}
      type="application/pdf"
      className="w-full h-full min-h-64"
    />
  );
}

function ImageViewer({
  content,
  filename,
}: {
  content: string;
  filename?: string;
}) {
  const src = content.startsWith("data:")
    ? content
    : `data:image/*;base64,${content}`;
  return (
    <img
      src={src}
      alt={filename ?? "artifact"}
      className="max-w-full max-h-96 object-contain rounded"
    />
  );
}

// ─── Type icon ────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  DetectedType,
  { icon: React.ReactNode; label: string }
> = {
  markdown: { icon: <FileText className="w-3.5 h-3.5" />, label: "Markdown" },
  csv: { icon: <Table2 className="w-3.5 h-3.5" />, label: "CSV" },
  json: { icon: <Braces className="w-3.5 h-3.5" />, label: "JSON" },
  pdf: { icon: <File className="w-3.5 h-3.5" />, label: "PDF" },
  image: { icon: <FileImage className="w-3.5 h-3.5" />, label: "Image" },
  plain: { icon: <FileText className="w-3.5 h-3.5" />, label: "Text" },
};

// ─── Main component ───────────────────────────────────────────────────────────

export function ArtifactViewer({
  content,
  mimeType,
  filename,
  className,
}: ArtifactViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const type = useMemo(
    () => detectType(content, mimeType, filename),
    [content, mimeType, filename],
  );
  const meta = TYPE_META[type];

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] overflow-hidden",
        expanded && "fixed inset-4 z-50 flex flex-col",
        className,
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--surface-border)] bg-zinc-900/50">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          {meta.icon}
          <span className="text-xs">{filename ?? meta.label}</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Content */}
      <div
        className={cn("overflow-auto p-3", expanded ? "flex-1" : "max-h-80")}
      >
        {type === "json" && <JsonViewer content={content} />}
        {type === "csv" && <CsvViewer content={content} />}
        {type === "markdown" && <MarkdownViewer content={content} />}
        {type === "plain" && (
          <pre className="text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words">
            {content}
          </pre>
        )}
        {type === "pdf" && <PdfViewer content={content} />}
        {type === "image" && (
          <ImageViewer content={content} filename={filename} />
        )}
      </div>
    </div>
  );
}

export default ArtifactViewer;
