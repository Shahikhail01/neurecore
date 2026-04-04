/**
 * Geocoding Tool - P2-3 of remaining tools
 * Enables AI agents to convert addresses to coordinates and vice versa
 * For Logistics, Facilities agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for geocoding operations
 * - OCP: Extensible via geocoding provider interfaces
 * - DIP: Depends on abstractions for geocoding providers
 */

import { Injectable, Logger } from '@nestjs/common';
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

export const GeocodingActionEnum = z.enum([
  'geocode_address',
  'reverse_geocode',
  'calculate_distance',
  'find_nearby',
  'get_route',
  'batch_geocode',
]);

export type GeocodingAction = z.infer<typeof GeocodingActionEnum>;

export const GeocodingInputSchema = z.object({
  action: GeocodingActionEnum.describe('The geocoding action to perform'),
  address: z.string().optional().describe('Address to geocode'),
  latitude: z.number().optional().describe('Latitude for reverse geocoding'),
  longitude: z.number().optional().describe('Longitude for reverse geocoding'),
  origin: z
    .object({
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional()
    .describe('Origin for route/distance'),
  destination: z
    .object({
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional()
    .describe('Destination for route/distance'),
  addresses: z
    .array(z.string())
    .optional()
    .describe('Addresses for batch geocoding'),
  query: z.string().optional().describe('Query for nearby search'),
  radius: z.number().positive().optional().describe('Search radius in meters'),
  mode: z
    .enum(['driving', 'walking', 'cycling', 'transit'])
    .optional()
    .default('driving')
    .describe('Travel mode'),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type GeocodingInput = z.infer<typeof GeocodingInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type GeocodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  components: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  accuracy: string;
};

type ReverseGeocodeResult = {
  address: string;
  components: {
    street: string;
    city: string;
    state: string;
    country: string;
  };
};

type DistanceResult = {
  distance: number;
  duration: number;
  distanceUnit: string;
  durationUnit: string;
};

type NearbyPlace = {
  name: string;
  latitude: number;
  longitude: number;
  distance: number;
  type: string;
};

type RouteResult = {
  distance: number;
  duration: number;
  steps: Array<{
    instruction: string;
    distance: number;
    duration: number;
  }>;
  polyline: string;
};

type BatchGeocodeResult = Array<{
  address: string;
  success: boolean;
  result?: GeocodeResult;
  error?: string;
}>;

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IGeocodingProvider {
  geocodeAddress(address: string): Promise<GeocodeResult>;
  reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult>;
  calculateDistance(
    origin: { lat?: number; lng?: number; address?: string },
    destination: { lat?: number; lng?: number; address?: string },
    mode?: string,
  ): Promise<DistanceResult>;
  findNearby(
    latitude: number,
    longitude: number,
    query: string,
    radius?: number,
  ): Promise<NearbyPlace[]>;
  getRoute(
    origin: { lat?: number; lng?: number; address?: string },
    destination: { lat?: number; lng?: number; address?: string },
    mode?: string,
  ): Promise<RouteResult>;
  batchGeocode(addresses: string[]): Promise<BatchGeocodeResult>;
}

// ─────────────────────────────────────────────────────────────
// Mock Geocoding Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockGeocodingProvider implements IGeocodingProvider {
  private readonly logger = new Logger(MockGeocodingProvider.name);

  async geocodeAddress(address: string): Promise<GeocodeResult> {
    this.logger.log('Geocoding address: ' + address);

    return {
      latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
      longitude: -74.006 + (Math.random() - 0.5) * 0.1,
      formattedAddress: address,
      components: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        postalCode: '10001',
      },
      accuracy: 'high',
    };
  }

  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult> {
    this.logger.log('Reverse geocoding: ' + latitude + ', ' + longitude);

    return {
      address: '123 Main St, New York, NY 10001, USA',
      components: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
      },
    };
  }

  async calculateDistance(
    origin: { lat?: number; lng?: number; address?: string },
    destination: { lat?: number; lng?: number; address?: string },
    mode?: string,
  ): Promise<DistanceResult> {
    this.logger.log('Calculating distance');

    const originLat = origin.lat || 40.7128;
    const originLng = origin.lng || -74.006;
    const destLat = destination.lat || 40.758;
    const destLng = destination.lng || -73.9855;

    // Simple distance calculation (Haversine formula approximation)
    const distance =
      Math.sqrt(
        Math.pow(destLat - originLat, 2) + Math.pow(destLng - originLng, 2),
      ) * 111; // Rough km conversion

    const duration = mode === 'driving' ? distance * 2 : distance * 5;

    return {
      distance: Number(distance.toFixed(2)),
      duration: Math.floor(duration),
      distanceUnit: 'km',
      durationUnit: 'minutes',
    };
  }

  async findNearby(
    latitude: number,
    longitude: number,
    query: string,
    radius?: number,
  ): Promise<NearbyPlace[]> {
    this.logger.log('Finding nearby: ' + query);

    return [
      {
        name: 'Nearest ' + query,
        latitude: latitude + 0.01,
        longitude: longitude + 0.01,
        distance: 500,
        type: query,
      },
      {
        name: 'Second nearest ' + query,
        latitude: latitude + 0.02,
        longitude: longitude + 0.02,
        distance: 1000,
        type: query,
      },
    ];
  }

  async getRoute(
    origin: { lat?: number; lng?: number; address?: string },
    destination: { lat?: number; lng?: number; address?: string },
    mode?: string,
  ): Promise<RouteResult> {
    this.logger.log('Getting route');

    const distance = await this.calculateDistance(origin, destination, mode);

    return {
      distance: distance.distance,
      duration: distance.duration,
      steps: [
        { instruction: 'Start heading north', distance: 1, duration: 2 },
        { instruction: 'Turn right', distance: 0.5, duration: 1 },
        { instruction: 'Arrive at destination', distance: 0.1, duration: 1 },
      ],
      polyline: 'encoded-polyline-string',
    };
  }

  async batchGeocode(addresses: string[]): Promise<BatchGeocodeResult> {
    this.logger.log('Batch geocoding ' + addresses.length + ' addresses');

    const results: BatchGeocodeResult = [];

    for (const address of addresses) {
      try {
        const result = await this.geocodeAddress(address);
        results.push({
          address,
          success: true,
          result,
        });
      } catch (error) {
        results.push({
          address,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    return results;
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class GeocodingTool extends BaseStructuredTool {
  readonly name = 'geocoding';
  readonly description =
    'Convert addresses to coordinates, find nearby places, calculate routes and distances';
  readonly category = ToolCategory.LOCATION;
  readonly inputSchema = GeocodingInputSchema;

  private readonly log = new Logger(GeocodingTool.name);
  private readonly provider: IGeocodingProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockGeocodingProvider();
  }

  protected async executeImpl(
    input: GeocodingInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Geocoding action: ' + input.action);

    try {
      switch (input.action) {
        case 'geocode_address':
          return await this.handleGeocodeAddress(input);
        case 'reverse_geocode':
          return await this.handleReverseGeocode(input);
        case 'calculate_distance':
          return await this.handleCalculateDistance(input);
        case 'find_nearby':
          return await this.handleFindNearby(input);
        case 'get_route':
          return await this.handleGetRoute(input);
        case 'batch_geocode':
          return await this.handleBatchGeocode(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error('Geocoding action failed: ' + err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  private async handleGeocodeAddress(
    input: GeocodingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.address) {
      throw new Error('address is required for geocode_address action');
    }

    const result = await this.provider.geocodeAddress(input.address);

    return {
      success: true,
      data: result,
    };
  }

  private async handleReverseGeocode(
    input: GeocodingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (input.latitude === undefined || input.longitude === undefined) {
      throw new Error(
        'latitude and longitude are required for reverse_geocode action',
      );
    }

    const result = await this.provider.reverseGeocode(
      input.latitude,
      input.longitude,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleCalculateDistance(
    input: GeocodingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.origin || !input.destination) {
      throw new Error(
        'origin and destination are required for calculate_distance action',
      );
    }

    const result = await this.provider.calculateDistance(
      input.origin,
      input.destination,
      input.mode,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleFindNearby(
    input: GeocodingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (
      input.latitude === undefined ||
      input.longitude === undefined ||
      !input.query
    ) {
      throw new Error(
        'latitude, longitude, and query are required for find_nearby action',
      );
    }

    const result = await this.provider.findNearby(
      input.latitude,
      input.longitude,
      input.query,
      input.radius,
    );

    return {
      success: true,
      data: { places: result, count: result.length },
    };
  }

  private async handleGetRoute(
    input: GeocodingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.origin || !input.destination) {
      throw new Error(
        'origin and destination are required for get_route action',
      );
    }

    const result = await this.provider.getRoute(
      input.origin,
      input.destination,
      input.mode,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handleBatchGeocode(
    input: GeocodingInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.addresses || input.addresses.length === 0) {
      throw new Error('addresses array is required for batch_geocode action');
    }

    const result = await this.provider.batchGeocode(input.addresses);

    return {
      success: true,
      data: { results: result, count: result.length },
    };
  }
}
