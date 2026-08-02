'use client';

/**
 * PackageInheritanceBanner — Phase 5.B P9 admin UI surface.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.8.1 (P9) — when a Package has a
 * `parentPackageSlug` set (T8 cross-group inheritance), this banner surfaces
 * the relationship as a read-only badge with tooltip explaining inheritance.
 *
 * The actual `parentPackageId` is fetched via the admin's `packagesService.getById`
 * (or `list`) and exposed as `parentSlug` in the banner data. For Phase 5.B
 * we use a slug-based lookup since the FE Package type doesn't yet have
 * `parentPackageId`. A future Stage-2 enhancement can wire the FK into the FE
 * type and remove the slug fallback.
 *
 * Icons are inline SVG (admin workspace has no lucide-react dep).
 */

import { useEffect, useState } from 'react';
import { packagesService } from '@/services/packages.service';
import type { Package } from '@/services/packages.service';

interface Props {
  packageSlug: string;
  /** Kept for forward-compat when the FE Package type gains `parentPackageId`. */
  industrySlug?: string;
  /** Kept for forward-compat. */
  tierSlug?: string;
}

export function PackageInheritanceBanner({ packageSlug }: Props) {
  const [parent, setParent] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // We can't directly read parentPackageId from the FE Package type yet
        // (TODO Stage 2 — wire parentPackageId into the FE Package type). For
        // now we use the KNOWN_PARENTS catalog. When this package is a known
        // inheriting child AND the parent exists, show the banner.
        const KNOWN_PARENTS = new Set([
          'accounting-operations', // F&C — referenced by SPO family-office-reporting
        ]);
        if (!KNOWN_PARENTS.has(packageSlug)) {
          if (!cancelled) setLoading(false);
          return;
        }
        const found = await packagesService.getBySlug(packageSlug);
        if (!cancelled) setParent(found);
      } catch {
        // ignore — inheritance is a soft signal, not a blocker
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [packageSlug]);

  if (loading || !parent) return null;

  // We can't directly read parentPackageId from the FE Package type yet
  // (TODO Stage 2). For now we render a banner only when this is a known
  // inheriting child (spo-family-office-reporting) so the UI signal is honest.
  const KNOWN_INHERITING_CHILDREN = new Set([
    'spo-family-office-reporting',
  ]);
  if (!KNOWN_INHERITING_CHILDREN.has(packageSlug)) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
      <svg
        className="h-4 w-4 mt-0.5 text-blue-300 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <div className="flex-1">
        <div className="font-medium text-blue-100">
          Inherits from <span className="font-mono">{parent.slug}</span> ({parent.name})
        </div>
        <div className="flex items-start gap-1 mt-1 text-blue-200/80 text-xs">
          <svg
            className="h-3 w-3 mt-0.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            T8 cross-group inheritance. Departments/agents from the parent package are inherited at tenant-onboarding time.
            Read-only badge — set <span className="font-mono">parentPackageSlug</span> in the seeder config to modify.
          </span>
        </div>
      </div>
    </div>
  );
}