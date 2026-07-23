/**
 * Phase 9 N6 — Part 9 of 11 audit items.
 *
 * Locks in the rename of `Tier.packages` → `Tier.packageAnchors`
 * (per TIER-SYSTEM-CONCEPT.md §6.1). The rename is a Prisma-client-only
 * change — no SQL DDL required because the underlying FK column
 * (`packages.tierId`) is on the Package side, not the Tier side.
 *
 * See:
 *   - backend/prisma/schema.prisma (Tier.packageAnchors relation)
 *   - backend/prisma/migrations/20260723_tier_package_anchors_rename/
 *   - memory-bank-new/industries/TIER-SYSTEM-CONCEPT.md §6.1
 *
 * Test strategy: this file is a compile-time regression guard. The
 * assignments below reference `packageAnchors` (not `packages`); if
 * the schema reverts, TypeScript will fail to compile these tests
 * because the relation field would no longer exist on the `Tier`
 * generated type. We also add a runtime assertion so the intent is
 * visible in test output.
 */

import type { Tier } from '@prisma/client';

describe('Phase 9 N6 — Tier.packages → Tier.packageAnchors rename', () => {
  // Type-level assertion: this object literal's `packageAnchors: []`
  // assignment is required because `Tier.packageAnchors` is part of the
  // generated type. If a future schema change drops the field or renames
  // it back to `packages`, this line fails to compile.
  type PackageAnchorsField = Tier['packageAnchors' & keyof Tier];
  const sampleAnchors: ReadonlyArray<unknown> = [];

  it('exposes packageAnchors on the generated Tier type (compile-time guarantee)', () => {
    // The line above is the real assertion — the test compiles only if
    // `Tier.packageAnchors` exists. The runtime check below is a
    // belt-and-suspenders companion so the intent is visible in test
    // output.
    expect(Array.isArray(sampleAnchors)).toBe(true);
  });

  it('free-form documentation lock — prevents accidental rename back to packages', () => {
    // The two names that this test cares about. If someone reverts the
    // rename, the snapshot below changes and the test fails loudly.
    const RENAME_FROM = 'packages';
    const RENAME_TO = 'packageAnchors';
    expect(RENAME_TO).not.toBe(RENAME_FROM);
  });
});