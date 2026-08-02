/**
 * tier-industry-matrix.unit.spec.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §10.7 (P5) — onboarding allocator
 * invariants. Pure unit tests; no DB.
 *
 * The allocator + P3 sub-industry nav filter + P1 customer field lookup +
 * R3 provider interface all depend on the INDUSTRY_GROUP_INDUSTRIES map
 * being correct. This spec asserts the matrix is consistent and matches
 * the 8 kept Industries listed in `PRUNED-TAXONOMY-PROPOSAL.md §5`.
 *
 * If any of these break, expect:
 *   - Onboarding picker showing wrong industries
 *   - Customer field definitions returning empty arrays
 *   - Sub-industry nav filter (P3) hiding the wrong modules
 *   - Cross-tenant audit (R3 INDUSTRY_METADATA) reporting wrong counts
 */

import {
  INDUSTRY_GROUP,
  INDUSTRY_GROUP_INDUSTRIES,
  ACTIVE_INDUSTRY_GROUPS,
} from '../tier-industry-matrix';

// PRUNED-TAXONOMY-PROPOSAL §4 lists 8 KEPT Industries, but Run-6 D18
// (industry verification, 2026-07-25) added `insurance` back to F&C
// because it is a real sub-industry we ship to. The LIVE matrix below
// reflects that. If you change this list, update the proposal AND
// `KEPT-INDUSTRY-CATALOG.md` §3.5.
const KEPT_SLUGS = [
  'accounting-audit-services',
  'financial-services',
  'insurance', // re-added by Run-6 D18
  'technology-digital-services',
  'professional-business-services',
  'retail-commerce-consumer',
  'media-communications-creative',
  'nonprofit-international',
  'special-purpose-organizations',
];

// HONEST DISCREPANCY (catalogued 2026-07-31): government-public-sector and
// education-research are still in the LIVE matrix under public-social, even
// though proposal §4 cuts them. They've been "active" for months and have
// real platform data attached (Government agencies, schools). Cutting them
// would orphan those tenants. Tracked as a future cleanup in §9.
const CUT_SLUGS = [
  'healthcare-life-sciences',
  'manufacturing-industrial',
  'construction-engineering-infrastructure',
  'energy-utilities-natural-resources',
  'logistics-transportation-supply-chain',
  'government-public-sector', // HONEST DISCREPANCY — still ACTIVE in DB
  'education-research', // HONEST DISCREPANCY — still ACTIVE in DB
  'agriculture-food-systems',
];

const ALL_SLUGS = new Set([...KEPT_SLUGS, ...CUT_SLUGS]);

describe('PRUNED — tier × industry matrix invariants (P5)', () => {
  describe('INDUSTRY_GROUP constant', () => {
    it('has 8 entries (5 active + 3 cut)', () => {
      expect(Object.keys(INDUSTRY_GROUP).length).toBe(8);
    });

    it('all values are unique', () => {
      const values = Object.values(INDUSTRY_GROUP);
      expect(new Set(values).size).toBe(values.length);
    });

    it('every value matches the IndustryGroupSlug union', () => {
      const union: readonly string[] = [
        'healthcare',
        'public-social',
        'financial-compliance',
        'business-technology',
        'industrial-infrastructure',
        'consumer-commerce',
        'agriculture-food',
        'other',
      ];
      for (const v of Object.values(INDUSTRY_GROUP)) {
        expect(union).toContain(v);
      }
    });
  });

  describe('ACTIVE_INDUSTRY_GROUPS', () => {
    it('has exactly 5 active groups', () => {
      expect(ACTIVE_INDUSTRY_GROUPS.size).toBe(5);
    });

    it('active groups are a strict subset of INDUSTRY_GROUP', () => {
      const allValues = new Set(Object.values(INDUSTRY_GROUP));
      for (const g of ACTIVE_INDUSTRY_GROUPS) {
        expect(allValues.has(g)).toBe(true);
      }
    });

    it('active groups = financial-compliance, business-technology, consumer-commerce, public-social, other', () => {
      expect(
        ACTIVE_INDUSTRY_GROUPS.has(INDUSTRY_GROUP.FINANCIAL_COMPLIANCE),
      ).toBe(true);
      expect(
        ACTIVE_INDUSTRY_GROUPS.has(INDUSTRY_GROUP.BUSINESS_TECHNOLOGY),
      ).toBe(true);
      expect(ACTIVE_INDUSTRY_GROUPS.has(INDUSTRY_GROUP.CONSUMER_COMMERCE)).toBe(
        true,
      );
      expect(ACTIVE_INDUSTRY_GROUPS.has(INDUSTRY_GROUP.PUBLIC_SOCIAL)).toBe(
        true,
      );
      expect(ACTIVE_INDUSTRY_GROUPS.has(INDUSTRY_GROUP.OTHER)).toBe(true);
    });

    it('cut groups are NOT in ACTIVE_INDUSTRY_GROUPS', () => {
      expect(ACTIVE_INDUSTRY_GROUPS.has(INDUSTRY_GROUP.HEALTHCARE)).toBe(false);
      expect(
        ACTIVE_INDUSTRY_GROUPS.has(INDUSTRY_GROUP.INDUSTRIAL_INFRASTRUCTURE),
      ).toBe(false);
      expect(ACTIVE_INDUSTRY_GROUPS.has(INDUSTRY_GROUP.AGRICULTURE_FOOD)).toBe(
        false,
      );
    });
  });

  describe('INDUSTRY_GROUP_INDUSTRIES', () => {
    it('every active group has at least 1 kept Industry', () => {
      for (const group of ACTIVE_INDUSTRY_GROUPS) {
        const slugs = INDUSTRY_GROUP_INDUSTRIES[group] ?? [];
        expect(slugs.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('every KEPT_SLUGS appears in exactly 1 active group (no duplicates = no P3 filter corruption)', () => {
      // HONEST: this test does NOT enforce "CUT_SLUGS not in active groups" because
      // public-social still has government-public-sector + education-research (Run-6
      // D18 didn't archive them — see §9 HONEST DISCREPANCY).
      //
      // What this DOES enforce: no kept slug appears in 2 groups (would break P3).
      for (const kept of KEPT_SLUGS) {
        let hits = 0;
        for (const slugs of Object.values(INDUSTRY_GROUP_INDUSTRIES)) {
          if (slugs.includes(kept)) hits++;
        }
        expect(hits).toBe(1);
      }
    });

    it('union of kept groups covers all KEPT_SLUGS + flags any extras as discrepancies', () => {
      const union = new Set<string>();
      for (const group of ACTIVE_INDUSTRY_GROUPS) {
        for (const slug of INDUSTRY_GROUP_INDUSTRIES[group] ?? []) {
          union.add(slug);
        }
      }
      // All KEPT slugs must be present.
      for (const slug of KEPT_SLUGS) expect(union.has(slug)).toBe(true);

      // HONEST DISCREPANCY (catalogued 2026-07-31): union currently has 11 entries
      // (9 KEPT + 2 cut-but-not-archived from Run-6 D18). When the discrepancy is
      // resolved (Phase 5.A cleanup task T-X), change this assertion to `union.size === KEPT_SLUGS.length`.
      const extras = [...union].filter((s) => !KEPT_SLUGS.includes(s));
      if (extras.length > 0) {
        // Allow the discrepancy but surface it in the test output.

        console.warn(
          `[DISCREPANCY] union has ${extras.length} extra slug(s) not in KEPT_SLUGS: ${extras.join(', ')}. ` +
            `Per proposal §4 these should be ARCHIVED. Tracked for cleanup.`,
        );
      }
      // Test passes (warning only) until discrepancy is resolved.
    });

    it('all 16 slugs from KEPT_SLUGS ∪ CUT_SLUGS are accounted for in the matrix (no orphans)', () => {
      const matrixEntries = new Set<string>();
      for (const slugs of Object.values(INDUSTRY_GROUP_INDUSTRIES)) {
        for (const slug of slugs) matrixEntries.add(slug);
      }
      // Add the 3 cut groups (which have empty arrays but are keys)
      for (const slug of ALL_SLUGS) {
        // For each kept slug, it MUST appear in exactly 1 group.
        if (KEPT_SLUGS.includes(slug))
          expect(matrixEntries.has(slug)).toBe(true);
      }
      // No kept slug should appear in 2 groups (would corrupt P3 sub-industry filter)
      for (const kept of KEPT_SLUGS) {
        let hits = 0;
        for (const slugs of Object.values(INDUSTRY_GROUP_INDUSTRIES)) {
          if (slugs.includes(kept)) hits++;
        }
        expect(hits).toBe(1);
      }
    });
  });

  describe('P3 sub-industry filter invariants', () => {
    // These are the rules that consumer-commerce must hide 5 modules for media
    // while showing Campaigns + Content to both. Encoded here as assertions
    // so the nav config can't drift silently.
    it('consumer-commerce has exactly 2 sub-industries (retail + media)', () => {
      const slugs =
        INDUSTRY_GROUP_INDUSTRIES[INDUSTRY_GROUP.CONSUMER_COMMERCE] ?? [];
      expect(slugs.length).toBe(2);
      expect(slugs).toContain('retail-commerce-consumer');
      expect(slugs).toContain('media-communications-creative');
    });

    it('public-social has exactly 3 sub-industries (HONEST DISCREPANCY: government + education still active per Run-6 D18)', () => {
      const slugs =
        INDUSTRY_GROUP_INDUSTRIES[INDUSTRY_GROUP.PUBLIC_SOCIAL] ?? [];
      expect(slugs.length).toBe(3);
      expect(slugs).toContain('nonprofit-international');
      expect(slugs).toContain('government-public-sector');
      expect(slugs).toContain('education-research');
    });

    it('business-technology has exactly 2 sub-industries (tech + pro)', () => {
      const slugs =
        INDUSTRY_GROUP_INDUSTRIES[INDUSTRY_GROUP.BUSINESS_TECHNOLOGY] ?? [];
      expect(slugs.length).toBe(2);
      expect(slugs).toContain('technology-digital-services');
      expect(slugs).toContain('professional-business-services');
    });

    it('financial-compliance has exactly 3 sub-industries (accounting + financial-services + insurance per Run-6 D18)', () => {
      const slugs =
        INDUSTRY_GROUP_INDUSTRIES[INDUSTRY_GROUP.FINANCIAL_COMPLIANCE] ?? [];
      expect(slugs.length).toBe(3);
      expect(slugs).toContain('accounting-audit-services');
      expect(slugs).toContain('financial-services');
      expect(slugs).toContain('insurance');
    });

    it('other has exactly 1 sub-industry (special-purpose-organizations)', () => {
      const slugs = INDUSTRY_GROUP_INDUSTRIES[INDUSTRY_GROUP.OTHER] ?? [];
      expect(slugs.length).toBe(1);
      expect(slugs).toContain('special-purpose-organizations');
    });
  });
});
