/**
 * HttpMobileSupportMatrixSource — Phase 28 (P28) — CR-AI-1107.
 *
 * Live `IMobileSupportMatrixSource` that fetches the typed mobile
 * support matrix from the backend `GET /v1/mobile-support-matrix`
 * endpoint, falling back to the inlined static matrix when the network
 * or backend is unavailable (graceful degradation, never a broken UI).
 *
 * This closes the P28 gap where the FE only ever used the static
 * mirror: the gate now reads the canonical BE source, so the FE cannot
 * diverge from the BE matrix.
 *
 * SOLID:
 *   SRP — owns the HTTP fetch + fallback only.
 *   OCP — a new action = new BE matrix entry, no edits here.
 *   DIP — depends on `IMobileSupportMatrixSource` (implemented) and a
 *         small injected `fetch`-like loader so tests can substitute.
 */
import type {
  IMobileSupportMatrixSource,
  MobileSupportMatrix,
} from './mobile-matrix';
import { STATIC_MOBILE_MATRIX_V1 } from './static-matrix-source';

export type MatrixFetcher = (url: string) => Promise<MobileSupportMatrix>;

export const MOBILE_MATRIX_URL = '/api/v1/mobile-support-matrix';

export function defaultMatrixFetcher(url: string): Promise<MobileSupportMatrix> {
  return fetch(url, {
    headers: { Accept: 'application/json' },
  }).then(async (res) => {
    if (!res.ok) throw new Error(`mobile-support-matrix HTTP ${res.status}`);
    const json = (await res.json()) as MobileSupportMatrix;
    if (!json || !Array.isArray(json.actions)) {
      throw new Error('mobile-support-matrix payload malformed');
    }
    return json;
  });
}

export class HttpMobileSupportMatrixSource
  implements IMobileSupportMatrixSource
{
  private matrix: MobileSupportMatrix | null = null;

  constructor(
    private readonly fetcher: MatrixFetcher = defaultMatrixFetcher,
    private readonly url: string = MOBILE_MATRIX_URL,
  ) {}

  async load(): Promise<MobileSupportMatrix> {
    try {
      const fetched = await this.fetcher(this.url);
      if (!fetched || !Array.isArray(fetched.actions)) {
        throw new Error('mobile-support-matrix payload malformed');
      }
      this.matrix = fetched;
      return this.matrix;
    } catch {
      // Graceful degradation to the inlined matrix; the gate stays
      // usable offline and never surfaces a fetch error to the UI.
      this.matrix = STATIC_MOBILE_MATRIX_V1;
      return this.matrix;
    }
  }

  current(): MobileSupportMatrix | null {
    return this.matrix;
  }
}
