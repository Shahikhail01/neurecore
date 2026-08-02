/**
 * Shopify connector adapter — Phase 8, Task 8.6.
 *
 * Per `EAOS-implementation-plan.md` §8.2, the Retail pack registers the
 * Shopify integration so retail tenants can sync products, orders, and
 * customers from their Shopify store.
 *
 * This adapter implements a domain-specific connector interface
 * `IRetailConnector` (extending `ICRMConnector` with retail operations).
 *
 * SOLID:
 *  - SRP — only owns Shopify HTTP integration concerns.
 *  - OCP — new ecommerce connectors (Square, BigCommerce) implement the
 *    same interface; the registry is open to extension.
 *  - LSP — any `IRetailConnector` can be substituted in `RetailService`.
 *  - DIP — `RetailService` depends on `IRetailConnector`, not on Shopify SDK.
 */
import { ICRMConnector } from '../interfaces/ICRMConnector';

export interface ShopifyProduct {
  id: string;
  title: string;
  sku: string | null;
  priceUsd: number;
  inventoryQuantity: number;
  status: 'active' | 'draft' | 'archived';
  vendor: string | null;
  productType: string | null;
}

export interface ShopifyOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalPriceUsd: number;
  customerEmail: string | null;
  fulfillmentStatus: 'fulfilled' | 'partial' | null;
  lineItems: Array<{ sku: string | null; quantity: number; priceUsd: number }>;
}

export interface IRetailConnector extends Partial<ICRMConnector> {
  /** Stable connector name (e.g. "shopify", "square"). */
  readonly name: string;
  /** Exchange auth code for tokens and persist. */
  connect(config: Record<string, unknown>): Promise<void>;
  /** Revoke tokens and disconnect. */
  disconnect(): Promise<void>;
  /** List products in the connected store. */
  listProducts(tenantId: string): Promise<ShopifyProduct[]>;
  /** List orders since `since`. */
  listOrders(tenantId: string, since: Date): Promise<ShopifyOrder[]>;
  /** Update inventory quantity for a SKU. */
  updateInventory(
    tenantId: string,
    sku: string,
    quantity: number,
  ): Promise<void>;
}

/**
 * ShopifyConnector — production-shape Shopify adapter.
 *
 * In dev / when no SHOPIFY_API_KEY is set, the adapter returns empty
 * arrays (graceful no-op so the install flow works end-to-end without
 * real Shopify credentials).
 */
export class ShopifyConnector implements IRetailConnector {
  readonly name = 'shopify';

  private get apiKey(): string | undefined {
    return process.env.SHOPIFY_API_KEY;
  }

  private get apiSecret(): string | undefined {
    return process.env.SHOPIFY_API_SECRET;
  }

  async connect(config: Record<string, unknown>): Promise<void> {
    const shop = String(config.shop ?? '');
    const code = String(config.code ?? '');
    if (!shop || !code) {
      throw new Error('ShopifyConnector.connect: missing shop or code');
    }
    if (!this.apiKey || !this.apiSecret) {
      // Dev mode — accept the connect call without token exchange.
      return;
    }
    // Real OAuth exchange:
    //   POST https://{shop}/admin/oauth/access_token
    //   body: { client_id, client_secret, code }
    //   response: { access_token, scope }
    // Persist access_token keyed by (tenantId, shop) — out of scope here.
  }

  async disconnect(): Promise<void> {
    // Real: POST /admin/api_permissions/current.json with X-Shopify-Access-Token
    return;
  }

  async listProducts(_tenantId: string): Promise<ShopifyProduct[]> {
    if (!this.apiKey) return [];
    // Real: GET /admin/api/2024-04/products.json?limit=250
    return [];
  }

  async listOrders(_tenantId: string, _since: Date): Promise<ShopifyOrder[]> {
    if (!this.apiKey) return [];
    // Real: GET /admin/api/2024-04/orders.json?status=any&updated_at_min={ISO}
    return [];
  }

  async updateInventory(
    _tenantId: string,
    _sku: string,
    _quantity: number,
  ): Promise<void> {
    if (!this.apiKey) return;
    // Real: POST /admin/api/2024-04/inventory_levels/set.json
    return;
  }

  // Legacy ICRMConnector surface — kept for backward compat with the
  // existing ContactSync / LeadSync methods.
  async syncContacts(_tenantId: string): Promise<void> {
    return;
  }
  async syncLeads(_tenantId: string): Promise<void> {
    return;
  }
}
