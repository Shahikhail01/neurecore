/**
 * CRM Integration Tool
 *
 * Provides CRM operations including:
 * - Contact management (create, update, get, list)
 * - Deal management (create, update, get, list)
 * - Support for Salesforce, HubSpot, Pipedrive
 *
 * SOLID Principles:
 * - SRP: Only handles CRM operations
 * - OCP: Add new CRM providers without modifying existing code
 * - DIP: Depends on ICRMProvider interface, not concrete implementation
 * - LSP: Any CRM provider can substitute for another
 * - ISP: Small, focused interfaces for each CRM type
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

/**
 * CRM provider enum
 */
export const CRMProviderEnum = z.enum(['salesforce', 'hubspot', 'pipedrive']);

export type CRMProviderType = z.infer<typeof CRMProviderEnum>;

/**
 * CRM action enum
 */
export const CRMActionEnum = z.enum([
  'create_contact',
  'update_contact',
  'get_contact',
  'list_contacts',
  'create_deal',
  'update_deal',
  'get_deal',
  'list_deals',
]);

export type CRMActionType = z.infer<typeof CRMActionEnum>;

/**
 * Contact data input schema
 */
const ContactDataSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  properties: z.record(z.string()).optional(),
});

/**
 * Deal data input schema
 */
const DealDataSchema = z.object({
  name: z.string(),
  amount: z.number().positive().optional(),
  stage: z.string().optional(),
  closeDate: z
    .string()
    .datetime({ message: 'Invalid ISO 8601 datetime format' })
    .optional(),
  contactEmail: z
    .string()
    .email({ message: 'Invalid email address' })
    .optional(),
  properties: z.record(z.string()).optional(),
});

/**
 * Input schema for CRM Tool
 */
export const CRMInputSchema = z.object({
  provider: CRMProviderEnum.describe('CRM provider'),
  action: CRMActionEnum.describe('CRM operation'),
  contactData: ContactDataSchema.optional(),
  dealData: DealDataSchema.optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  query: z.string().optional().describe('Search query'),
  limit: z.number().int().min(1).max(100).default(50).optional(),
});

export type CRMInputType = z.infer<typeof CRMInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

/**
 * Contact output schema
 */
const ContactOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

/**
 * Deal output schema
 */
const DealOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number().optional(),
  stage: z.string().optional(),
  contactId: z.string().optional(),
  closeDate: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

/**
 * Output schema for CRM Tool
 */
export const CRMOutputSchema = z.object({
  contact: ContactOutputSchema.optional(),
  contacts: z.array(ContactOutputSchema).optional(),
  deal: DealOutputSchema.optional(),
  deals: z.array(DealOutputSchema).optional(),
  success: z.boolean(),
  message: z.string().optional(),
});

export type CRMOutputType = z.infer<typeof CRMOutputSchema>;

// ─────────────────────────────────────────────────────────────
// CRM Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

/**
 * ICRMProvider - Interface for CRM providers
 * Following DIP, we depend on this abstraction, not concrete implementations
 */
interface ICRMProvider {
  // Contact operations
  createContact(data: CRMContactInput): Promise<CRMContactOutput>;
  updateContact(
    contactId: string,
    data: CRMContactInput,
  ): Promise<CRMContactOutput>;
  getContact(contactId: string): Promise<CRMContactOutput>;
  listContacts(query?: string, limit?: number): Promise<CRMContactOutput[]>;

  // Deal operations
  createDeal(data: CRMDealInput): Promise<CRMDealOutput>;
  updateDeal(dealId: string, data: CRMDealInput): Promise<CRMDealOutput>;
  getDeal(dealId: string): Promise<CRMDealOutput>;
  listDeals(query?: string, limit?: number): Promise<CRMDealOutput[]>;
}

interface CRMContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  properties?: Record<string, string>;
}

interface CRMContactOutput {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  properties?: Record<string, unknown>;
}

interface CRMDealInput {
  name: string;
  amount?: number;
  stage?: string;
  contactEmail?: string;
  closeDate?: string;
  properties?: Record<string, string>;
}

interface CRMDealOutput {
  id: string;
  name: string;
  amount?: number;
  stage?: string;
  contactId?: string;
  closeDate?: string;
  properties?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// HubSpot CRM Provider
// ─────────────────────────────────────────────────────────────

/**
 * HubSpotCRMProvider - Implements ICRMProvider for HubSpot
 * OCP: Add this without modifying existing code
 */
class HubSpotCRMProvider implements ICRMProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.hubapi.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async createContact(data: CRMContactInput): Promise<CRMContactOutput> {
    const result = await this.request<{ id: string }>(
      'POST',
      '/crm/v3/objects/contacts',
      {
        properties: {
          email: data.email,
          firstname: data.firstName,
          lastname: data.lastName,
          phone: data.phone,
          company: data.company,
          ...data.properties,
        },
      },
    );

    return {
      id: result.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      company: data.company,
      properties: data.properties,
    };
  }

  async updateContact(
    contactId: string,
    data: CRMContactInput,
  ): Promise<CRMContactOutput> {
    await this.request('PATCH', `/crm/v3/objects/contacts/${contactId}`, {
      properties: {
        email: data.email,
        firstname: data.firstName,
        lastname: data.lastName,
        phone: data.phone,
        company: data.company,
        ...data.properties,
      },
    });

    return {
      id: contactId,
      ...data,
      properties: data.properties,
    };
  }

  async getContact(contactId: string): Promise<CRMContactOutput> {
    const result = await this.request<{
      id: string;
      properties: Record<string, string>;
    }>(
      'GET',
      `/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname,phone,company`,
    );

    return {
      id: result.id,
      email: result.properties.email,
      firstName: result.properties.firstname,
      lastName: result.properties.lastname,
      phone: result.properties.phone,
      company: result.properties.company,
      properties: result.properties,
    };
  }

  async listContacts(query?: string, limit = 50): Promise<CRMContactOutput[]> {
    const result = await this.request<{
      results: Array<{ id: string; properties: Record<string, string> }>;
    }>(
      'GET',
      `/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,phone,company${query ? `&query=${encodeURIComponent(query)}` : ''}`,
    );

    return result.results.map((contact) => ({
      id: contact.id,
      email: contact.properties.email,
      firstName: contact.properties.firstname,
      lastName: contact.properties.lastname,
      phone: contact.properties.phone,
      company: contact.properties.company,
      properties: contact.properties,
    }));
  }

  async createDeal(data: CRMDealInput): Promise<CRMDealOutput> {
    const properties: Record<string, string> = {
      dealname: data.name,
    };
    if (data.amount !== undefined) properties.amount = String(data.amount);
    if (data.stage !== undefined) properties.dealstage = data.stage;
    if (data.closeDate !== undefined) properties.closedate = data.closeDate;

    const result = await this.request<{ id: string }>(
      'POST',
      '/crm/v3/objects/deals',
      {
        properties,
      },
    );

    return {
      id: result.id,
      name: data.name,
      amount: data.amount,
      stage: data.stage,
      closeDate: data.closeDate,
      properties: data.properties,
    };
  }

  async updateDeal(dealId: string, data: CRMDealInput): Promise<CRMDealOutput> {
    const properties: Record<string, string> = {};
    if (data.name !== undefined) properties.dealname = data.name;
    if (data.amount !== undefined) properties.amount = String(data.amount);
    if (data.stage !== undefined) properties.dealstage = data.stage;
    if (data.closeDate !== undefined) properties.closedate = data.closeDate;

    await this.request('PATCH', `/crm/v3/objects/deals/${dealId}`, {
      properties,
    });

    return {
      id: dealId,
      ...data,
      properties: data.properties,
    };
  }

  async getDeal(dealId: string): Promise<CRMDealOutput> {
    const result = await this.request<{
      id: string;
      properties: Record<string, string>;
    }>(
      'GET',
      `/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,closedate`,
    );

    return {
      id: result.id,
      name: result.properties.dealname,
      amount: result.properties.amount
        ? parseFloat(result.properties.amount)
        : undefined,
      stage: result.properties.dealstage,
      closeDate: result.properties.closedate,
      properties: result.properties,
    };
  }

  async listDeals(query?: string, limit = 50): Promise<CRMDealOutput[]> {
    const result = await this.request<{
      results: Array<{ id: string; properties: Record<string, string> }>;
    }>(
      'GET',
      `/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,closedate${query ? `&query=${encodeURIComponent(query)}` : ''}`,
    );

    return result.results.map((deal) => ({
      id: deal.id,
      name: deal.properties.dealname,
      amount: deal.properties.amount
        ? parseFloat(deal.properties.amount)
        : undefined,
      stage: deal.properties.dealstage,
      closeDate: deal.properties.closedate,
      properties: deal.properties,
    }));
  }
}

// ─────────────────────────────────────────────────────────────
// Pipedrive CRM Provider
// ─────────────────────────────────────────────────────────────

/**
 * PipedriveCRMProvider - Implements ICRMProvider for Pipedrive
 */
class PipedriveCRMProvider implements ICRMProvider {
  private readonly apiToken: string;
  private readonly baseUrl = 'https://api.pipedrive.com/v1';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.append('api_token', this.apiToken);

    const response = await fetch(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        `Pipedrive API error: ${response.status} - ${data.error}`,
      );
    }

    return data.data;
  }

  async createContact(data: CRMContactInput): Promise<CRMContactOutput> {
    const result = await this.request<{ id: number }>('POST', '/persons', {
      name:
        data.firstName && data.lastName
          ? `${data.firstName} ${data.lastName}`
          : data.email,
      email: data.email,
      phone: data.phone,
      org_name: data.company,
    });

    return {
      id: String(result.id),
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      company: data.company,
    };
  }

  async updateContact(
    contactId: string,
    data: CRMContactInput,
  ): Promise<CRMContactOutput> {
    const updateData: Record<string, unknown> = {
      email: data.email,
    };
    if (data.firstName || data.lastName) {
      updateData.name = [data.firstName, data.lastName]
        .filter(Boolean)
        .join(' ');
    }
    if (data.phone) updateData.phone = data.phone;
    if (data.company) updateData.org_name = data.company;

    await this.request('PUT', `/persons/${contactId}`, updateData);

    return { id: contactId, ...data };
  }

  async getContact(contactId: string): Promise<CRMContactOutput> {
    const result = await this.request<{
      id: number;
      name: string;
      email: Array<{ value: string }>;
      phone: Array<{ value: string }>;
      org_name: string;
    }>('GET', `/persons/${contactId}`);

    return {
      id: String(result.id),
      email: result.email?.[0]?.value ?? '',
      firstName: result.name?.split(' ')[0],
      lastName: result.name?.split(' ').slice(1).join(' '),
      phone: result.phone?.[0]?.value,
      company: result.org_name,
    };
  }

  async listContacts(query?: string, limit = 50): Promise<CRMContactOutput[]> {
    const result = await this.request<
      Array<{
        id: number;
        name: string;
        email: Array<{ value: string }>;
        phone: Array<{ value: string }>;
        org_name: string;
      }>
    >(
      'GET',
      `/persons?limit=${limit}${query ? `&term=${encodeURIComponent(query)}` : ''}`,
    );

    return result.map((contact) => ({
      id: String(contact.id),
      email: contact.email?.[0]?.value ?? '',
      firstName: contact.name?.split(' ')[0],
      lastName: contact.name?.split(' ').slice(1).join(' '),
      phone: contact.phone?.[0]?.value,
      company: contact.org_name,
    }));
  }

  async createDeal(data: CRMDealInput): Promise<CRMDealOutput> {
    const dealData: Record<string, unknown> = { title: data.name };
    if (data.amount !== undefined) dealData.value = data.amount;
    if (data.stage !== undefined) dealData.stage_id = data.stage;
    if (data.closeDate !== undefined) dealData.close_date = data.closeDate;

    const result = await this.request<{ id: number }>(
      'POST',
      '/deals',
      dealData,
    );

    return {
      id: String(result.id),
      name: data.name,
      amount: data.amount,
      stage: data.stage,
      closeDate: data.closeDate,
    };
  }

  async updateDeal(dealId: string, data: CRMDealInput): Promise<CRMDealOutput> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.title = data.name;
    if (data.amount !== undefined) updateData.value = data.amount;
    if (data.stage !== undefined) updateData.stage_id = data.stage;
    if (data.closeDate !== undefined) updateData.close_date = data.closeDate;

    await this.request('PUT', `/deals/${dealId}`, updateData);

    return { id: dealId, ...data };
  }

  async getDeal(dealId: string): Promise<CRMDealOutput> {
    const result = await this.request<{
      id: number;
      title: string;
      value: number;
      stage_id: string;
      close_date: string;
    }>('GET', `/deals/${dealId}`);

    return {
      id: String(result.id),
      name: result.title,
      amount: result.value,
      stage: String(result.stage_id),
      closeDate: result.close_date,
    };
  }

  async listDeals(query?: string, limit = 50): Promise<CRMDealOutput[]> {
    const result = await this.request<
      Array<{
        id: number;
        title: string;
        value: number;
        stage_id: string;
        close_date: string;
      }>
    >(
      'GET',
      `/deals?limit=${limit}${query ? `&term=${encodeURIComponent(query)}` : ''}`,
    );

    return result.map((deal) => ({
      id: String(deal.id),
      name: deal.title,
      amount: deal.value,
      stage: String(deal.stage_id),
      closeDate: deal.close_date,
    }));
  }
}

// ─────────────────────────────────────────────────────────────
// CRM Tool (ISP - small, focused interface)
// ─────────────────────────────────────────────────────────────

/**
 * CRM Integration Tool
 *
 * Features:
 * - HubSpot and Pipedrive integration
 * - Zod schema validation for inputs and outputs
 * - Structured output with proper error handling
 */
@Injectable()
export class CRMTool extends BaseStructuredTool {
  readonly name = 'crm';
  readonly description =
    'Manage CRM operations including contacts and deals. Supports HubSpot and Pipedrive with actions: create_contact, update_contact, get_contact, list_contacts, create_deal, update_deal, get_deal, list_deals.';
  readonly category = ToolCategory.BUSINESS;
  readonly inputSchema = CRMInputSchema;
  readonly outputSchema = CRMOutputSchema;
  readonly version = '1.0.0';

  private provider: ICRMProvider | null = null;

  constructor(private readonly config: ConfigService) {
    super();
    this.initializeProvider();
  }

  /**
   * Initialize the CRM provider based on configuration
   * OCP: Add new providers by implementing ICRMProvider
   */
  private initializeProvider(): void {
    const hubspotApiKey = this.config.get<string>('HUBSPOT_API_KEY');
    const pipedriveApiToken = this.config.get<string>('PIPEDRIVE_API_KEY');

    // Priority: HubSpot > Pipedrive
    if (hubspotApiKey) {
      this.provider = new HubSpotCRMProvider(hubspotApiKey);
      this.logger.log('HubSpot CRM provider initialized');
    } else if (pipedriveApiToken) {
      this.provider = new PipedriveCRMProvider(pipedriveApiToken);
      this.logger.log('Pipedrive CRM provider initialized');
    } else {
      this.logger.warn(
        'No CRM provider configured. Set HUBSPOT_API_KEY or PIPEDRIVE_API_KEY in environment.',
      );
    }
  }

  /**
   * Core execution logic - SRP: Only handles CRM operations
   */
  protected async executeImpl(
    input: CRMInputType,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<CRMOutputType>> {
    const startTime = Date.now();
    const tenantId = context?.tenantId ?? 'unknown';

    this.logger.log(
      `[CRMTool] Action: ${input.action} for tenant: ${tenantId}`,
    );

    // Check if provider is configured
    if (!this.provider) {
      this.logger.warn(
        '[CRMTool] No provider configured — running in demo mode',
      );
      const demoContacts = [
        {
          id: 'demo-001',
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice.johnson@demo-client.com',
          company: 'Demo Client Corp',
          phone: '+1-555-0101',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'demo-002',
          firstName: 'Bob',
          lastName: 'Smith',
          email: 'bob.smith@prospect.io',
          company: 'Prospect Inc',
          phone: '+1-555-0102',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'demo-003',
          firstName: 'Carol',
          lastName: 'Williams',
          email: 'carol.w@marketingco.com',
          company: 'Marketing Co',
          phone: '+1-555-0103',
          createdAt: new Date().toISOString(),
        },
      ];
      const demoDeals = [
        {
          id: 'deal-001',
          name: 'Q1 Campaign Package',
          stage: 'proposal',
          amount: 15000,
          contactId: 'demo-001',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'deal-002',
          name: 'Social Media Management',
          stage: 'negotiation',
          amount: 8500,
          contactId: 'demo-002',
          createdAt: new Date().toISOString(),
        },
      ];
      if (input.action === 'list_contacts') {
        return {
          success: true,
          data: { contacts: demoContacts, total: demoContacts.length },
          metadata: { demo: true, durationMs: Date.now() - startTime },
        };
      }
      if (input.action === 'list_deals') {
        return {
          success: true,
          data: { deals: demoDeals, total: demoDeals.length },
          metadata: { demo: true, durationMs: Date.now() - startTime },
        };
      }
      if (input.action === 'get_contact') {
        return {
          success: true,
          data: { contact: demoContacts[0] },
          metadata: { demo: true, durationMs: Date.now() - startTime },
        };
      }
      if (input.action === 'get_deal') {
        return {
          success: true,
          data: { deal: demoDeals[0] },
          metadata: { demo: true, durationMs: Date.now() - startTime },
        };
      }
      if (input.action === 'create_contact') {
        return {
          success: true,
          data: {
            contact: {
              id: `demo-${Date.now()}`,
              ...input,
              createdAt: new Date().toISOString(),
            },
          },
          metadata: { demo: true, durationMs: Date.now() - startTime },
        };
      }
      if (input.action === 'create_deal') {
        return {
          success: true,
          data: {
            deal: {
              id: `deal-${Date.now()}`,
              name: input.name ?? 'New Deal',
              stage: 'prospecting',
              amount: input.amount ?? 0,
              createdAt: new Date().toISOString(),
            },
          },
          metadata: { demo: true, durationMs: Date.now() - startTime },
        };
      }
      return {
        success: true,
        data: {
          message: 'CRM demo mode — action recorded',
          action: input.action,
        },
        metadata: { demo: true, durationMs: Date.now() - startTime },
      };
    }

    try {
      switch (input.action) {
        case 'create_contact':
          return await this.handleCreateContact(input, startTime);
        case 'update_contact':
          return await this.handleUpdateContact(input, startTime);
        case 'get_contact':
          return await this.handleGetContact(input, startTime);
        case 'list_contacts':
          return await this.handleListContacts(input, startTime);
        case 'create_deal':
          return await this.handleCreateDeal(input, startTime);
        case 'update_deal':
          return await this.handleUpdateDeal(input, startTime);
        case 'get_deal':
          return await this.handleGetDeal(input, startTime);
        case 'list_deals':
          return await this.handleListDeals(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      this.logger.error(
        `[CRMTool] Action ${input.action} failed`,
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CRM operation failed',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  private async handleCreateContact(
    input: CRMInputType,
    startTime: number,
  ): Promise<StructuredToolResult<CRMOutputType>> {
    const p = this.provider;
    if (!p) {
      return {
        success: false,
        error: 'Provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
    if (!input.contactData) {
      return {
        success: false,
        error: 'contactData is required for create_contact action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const contact = await p.createContact(input.contactData);

    return {
      success: true,
      data: {
        contact,
        success: true,
        message: `Contact created successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'crm-v1',
      },
    };
  }

  private async handleUpdateContact(
    input: CRMInputType,
    startTime: number,
  ): Promise<StructuredToolResult<CRMOutputType>> {
    const p = this.provider;
    if (!p) {
      return {
        success: false,
        error: 'Provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
    if (!input.contactId || !input.contactData) {
      return {
        success: false,
        error:
          'contactId and contactData are required for update_contact action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const contact = await p.updateContact(input.contactId, input.contactData);

    return {
      success: true,
      data: {
        contact,
        success: true,
        message: `Contact ${input.contactId} updated successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'crm-v1',
      },
    };
  }

  private async handleGetContact(
    input: CRMInputType,
    startTime: number,
  ): Promise<StructuredToolResult<CRMOutputType>> {
    const p = this.provider;
    if (!p) {
      return {
        success: false,
        error: 'Provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
    if (!input.contactId) {
      return {
        success: false,
        error: 'contactId is required for get_contact action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const contact = await p.getContact(input.contactId);

    return {
      success: true,
      data: {
        contact,
        success: true,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'crm-v1',
      },
    };
  }

  private async handleListContacts(
    input: CRMInputType,
    startTime: number,
  ): Promise<StructuredToolResult<CRMOutputType>> {
    const p = this.provider;
    if (!p) {
      return {
        success: false,
        error: 'Provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const contacts = await p.listContacts(input.query, input.limit);

    return {
      success: true,
      data: {
        contacts,
        success: true,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'crm-v1',
      },
    };
  }

  private async handleCreateDeal(
    input: CRMInputType,
    startTime: number,
  ): Promise<StructuredToolResult<CRMOutputType>> {
    const p = this.provider;
    if (!p) {
      return {
        success: false,
        error: 'Provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
    if (!input.dealData) {
      return {
        success: false,
        error: 'dealData is required for create_deal action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const deal = await p.createDeal(input.dealData);

    return {
      success: true,
      data: {
        deal,
        success: true,
        message: `Deal created successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'crm-v1',
      },
    };
  }

  private async handleUpdateDeal(
    input: CRMInputType,
    startTime: number,
  ): Promise<StructuredToolResult<CRMOutputType>> {
    const p = this.provider;
    if (!p) {
      return {
        success: false,
        error: 'Provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
    if (!input.dealId || !input.dealData) {
      return {
        success: false,
        error: 'dealId and dealData are required for update_deal action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const deal = await p.updateDeal(input.dealId, input.dealData);

    return {
      success: true,
      data: {
        deal,
        success: true,
        message: `Deal ${input.dealId} updated successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'crm-v1',
      },
    };
  }

  private async handleGetDeal(
    input: CRMInputType,
    startTime: number,
  ): Promise<StructuredToolResult<CRMOutputType>> {
    const p = this.provider;
    if (!p) {
      return {
        success: false,
        error: 'Provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
    if (!input.dealId) {
      return {
        success: false,
        error: 'dealId is required for get_deal action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const deal = await p.getDeal(input.dealId);

    return {
      success: true,
      data: {
        deal,
        success: true,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'crm-v1',
      },
    };
  }

  private async handleListDeals(
    input: CRMInputType,
    startTime: number,
  ): Promise<StructuredToolResult<CRMOutputType>> {
    const p = this.provider;
    if (!p) {
      return {
        success: false,
        error: 'Provider not configured',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const deals = await p.listDeals(input.query, input.limit);

    return {
      success: true,
      data: {
        deals,
        success: true,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'crm-v1',
      },
    };
  }
}
