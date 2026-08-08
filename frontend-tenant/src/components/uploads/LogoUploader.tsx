'use client';

// components/uploads/LogoUploader.tsx — Reusable logo upload UI.
// Used by Tier-1 onboarding (Logo step) and by the Company sub-wizard.
// Behaviour: preview / replace / remove, client-side type + size validation,
// progress text while uploading, error inline. Calls `onChange(url | null)`
// so the parent owns persistence.

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { uploadsService, LOGO_UPLOAD } from '@/services/uploads.service';
import { assetUrl } from '@/lib/url';

export interface LogoUploaderProps {
  /** Current logo URL (or null if none). */
  value: string | null;
  /** Called with the new URL on upload, or `null` on remove. */
  onChange: (url: string | null) => void;
  /** Disable the uploader (e.g. during save). */
  disabled?: boolean;
  /** Optional className for the outer container. */
  className?: string;
}

export function LogoUploader({
  value,
  onChange,
  disabled = false,
  className = '',
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);

    if (file.size > LOGO_UPLOAD.maxBytes) {
      setError(`Logo exceeds ${LOGO_UPLOAD.maxBytes / (1024 * 1024)} MB limit`);
      return;
    }
    if (!(LOGO_UPLOAD.allowedTypes as readonly string[]).includes(file.type)) {
      setError(`Unsupported type. Use PNG, JPEG, WEBP, or SVG.`);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadsService.uploadLogo(file);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected later.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setError(null);
    onChange(null);
  };

  return (
    <div className={`flex items-start gap-4 ${className}`}>
      {/* Preview / placeholder */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40 flex items-center justify-center">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetUrl(value)}
            alt="Logo preview"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs text-muted-foreground">No logo</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 min-w-0">
        <input
          ref={inputRef}
          type="file"
          aria-label="Upload logo"
          accept={LOGO_UPLOAD.allowedTypes.join(',')}
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
          disabled={disabled || uploading}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
          >
            {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload logo'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || uploading}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, WEBP, or SVG. Max {LOGO_UPLOAD.maxBytes / (1024 * 1024)} MB.
        </p>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}