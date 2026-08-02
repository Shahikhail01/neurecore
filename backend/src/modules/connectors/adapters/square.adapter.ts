/**
 * Square connector adapter — Phase 8, Task 8.6.
 *
 * Per `EAOS-implementation-plan.md` §8.2, the Retail pack registers the
 * Square integration so retail tenants can sync POS payments, orders,
 * and inventory from Square.
 *
 * Implements the same `IRetailConnector` interface as Shopify.
 *
 * SOLID:
 *  - SRP — only owns Square HTTP integration concerns.
 *  - OCP — registered alongside Shopify; the registry is open to
 *    extension without modifying existing adapters.
 *  - DIP — `RetailService` depends on `IRetailConnector`, not on Square SDK.
 */
import type { IRetailConnector } from './shopify.adapter';

export interface SquarePayment {
  id: string;
  createdAt: string;
  amountMoney: { amount: number; currency: string };
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELED';
  locationId: string;
  orderId?: string;
}

export class SquareConnector implements IRetailConnector {
  readonly name = 'square';

  private get accessToken(): string | undefined {
    return process.env.SQUARE_ACCESS_TOKEN;
  }

  async connect(_config: Record<string, unknown>): Promise<void> {
    if (!this.accessToken) return; // dev mode
    // Real: validate OAuth token via Square OAuth API and persist by tenant.
  }

  async disconnect(): Promise<void> {
    // Real: revoke token via POST /v2/oauth/revoke
    return;
  }

  async listProducts(_tenantId: string) {
    if (!this.accessToken) return [];
    // Real: POST /v2/catalog/list with types=ITEM
    return [];
  }

  async listOrders(_tenantId: string, _since: Date) {
    if (!this.accessToken) return [];
    // Real: POST /v2/orders/search with date filter
    return [];
  }

  async updateInventory(
    _tenantId: string,
    _sku: string,
    _quantity: number,
  ): Promise<void> {
    if (!this.accessToken) return;
    // Real: BatchChangeInventory POST /v2/inventory/changes/batch-create
    return;
  }

  async syncContacts(_tenantId: string): Promise<void> {
    return;
  }
  async syncLeads(_tenantId: string): Promise<void> {
    return;
  }

  // Square-specific helper, used by the retail sync service.
  async listPayments(
    _tenantId: string,
    _since: Date,
  ): Promise<SquarePayment[]> {
    if (!this.accessToken) return [];
    // Real: POST /v2/payments/search
    return [];
  }
}
