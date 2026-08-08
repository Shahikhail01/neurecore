/**
 * Phase 29 — Static a11y engine fixtures (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * Three documents drive the G29 detection gates:
 *   • VIOLATING_FIXTURE  — one seeded violation per registered rule.
 *   • CONFORMANT_FIXTURE — the same UI, written accessibly.
 *   • COMMENT_FIXTURE    — markup that only appears inside comments.
 *
 * Keeping them as literal source strings (not files on disk) means
 * the gate proves the engine, not the repository state.
 */

export interface A11yFixture {
  readonly path: string;
  readonly source: string;
}

/** One violation per rule, in registry order. */
export const VIOLATING_FIXTURE: A11yFixture = {
  path: 'fixtures/violating.tsx',
  source: `export function Violating() {
  return (
    <html>
      <body>
        <h1>Customers</h1>
        <h3>Skipped a level</h3>
        <img src="/logo.png" />
        <input type="text" value="" onChange={noop} />
        <div onClick={noop}>Clickable but not operable</div>
        <span tabIndex={3}>Positive tab index</span>
        <iframe src="/embed" />
        <button className="h-4 w-4">x</button>
      </body>
    </html>
  );
}
`,
};

/** The same screen written to conform — the engine must stay silent. */
export const CONFORMANT_FIXTURE: A11yFixture = {
  path: 'fixtures/conformant.tsx',
  source: `export function Conformant() {
  return (
    <html lang="en">
      <body>
        <h1>Customers</h1>
        <h2>Filters</h2>
        <img src="/logo.png" alt="NeureCore" />
        <label htmlFor="search">Search</label>
        <input id="search" type="text" value="" onChange={noop} />
        <div
          role="button"
          tabIndex={0}
          onClick={noop}
          onKeyDown={noop}
        >
          Operable
        </div>
        <span tabIndex={0}>Document order</span>
        <iframe src="/embed" title="Embedded report" />
        <button className="h-6 w-6" aria-label="Close">x</button>
        <div role="presentation" onClick={stopPropagation}>
          <button type="button" aria-label="Row action">a</button>
        </div>
      </body>
    </html>
  );
}
`,
};

/** Markup that exists only in prose — never a violation. */
export const COMMENT_FIXTURE: A11yFixture = {
  path: 'fixtures/comments.tsx',
  source: `/**
 * The shell renders <html class="dark"> without a lang attribute in
 * the legacy branch, and an <img src="x" /> placeholder.
 */
export function Documented() {
  // <input type="text" /> used to live here.
  /* <div onClick={noop}>legacy</div> */
  return <p>Nothing to report.</p>;
}
`,
};
