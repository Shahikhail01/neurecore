// ─── IDataAdapter.ts ─────────────────────────────────────────────────────────
// LSP: All adapters are substitutable - same shape, different entity mapping.
// SRP: One responsibility — transform raw API data into domain objects.

export interface IDataAdapter<Raw, Domain> {
  /** Transform raw API payload → clean domain object */
  adapt(raw: Raw): Domain;
  /** Reverse: domain object → API payload for mutations */
  reverse(domain: Domain): Partial<Raw>;
}

export interface IBatchAdapter<Raw, Domain> extends IDataAdapter<Raw, Domain> {
  adaptMany(raws: Raw[]): Domain[];
}
