/**
 * Maps Tool - Tool 12 of 12
 * Enables AI agents to perform location-based operations
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for location operations
 * - OCP: Extensible via map providers
 * - DIP: Depends on abstractions for geolocation services
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

export const MapsActionEnum = z.enum([
  'geocode',
  'reverse_geocode',
  'directions',
  'search',
  'distance',
]);

export type MapsAction = z.infer<typeof MapsActionEnum>;

export const MapsInputSchema = z.object({
  action: MapsActionEnum.describe('The maps action to perform'),
  address: z.string().optional().describe('Address to geocode'),
  latitude: z.number().optional().describe('Latitude for reverse geocode'),
  longitude: z.number().optional().describe('Longitude for reverse geocode'),
  origin: z.string().optional().describe('Origin location for directions'),
  destination: z.string().optional().describe('Destination for directions'),
  query: z.string().optional().describe('Place search query'),
  mode: z
    .enum(['driving', 'walking', 'bicycling', 'transit'])
    .optional()
    .describe('Travel mode'),
});

export type MapsInput = z.infer<typeof MapsInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

export const MapsOutputSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  address: z.string().optional(),
  results: z
    .array(
      z.object({
        name: z.string(),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .optional(),
  distance: z.number().optional(),
  duration: z.number().optional(),
  message: z.string().optional(),
});

export type MapsOutput = z.infer<typeof MapsOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Maps Tool
// ─────────────────────────────────────────────────────────────

@Injectable()
export class MapsTool extends BaseStructuredTool {
  readonly name = 'maps';
  readonly description =
    'Perform location-based operations including geocoding, directions, and place search';
  readonly category = ToolCategory.LOCATION;
  readonly inputSchema = MapsInputSchema;
  readonly outputSchema = MapsOutputSchema;
  readonly version = '1.0.0';

  constructor(private readonly config: ConfigService) {
    super();
  }

  protected async executeImpl(
    input: MapsInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<MapsOutput>> {
    const startTime = Date.now();

    try {
      switch (input.action) {
        case 'geocode':
          return await this.handleGeocode(input, startTime);
        case 'reverse_geocode':
          return await this.handleReverseGeocode(input, startTime);
        case 'directions':
          return await this.handleDirections(input, startTime);
        case 'search':
          return await this.handleSearch(input, startTime);
        case 'distance':
          return await this.handleDistance(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Maps operation failed',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  private async handleGeocode(
    input: MapsInput,
    startTime: number,
  ): Promise<StructuredToolResult<MapsOutput>> {
    const { address } = input;

    if (!address) {
      return {
        success: false,
        error: 'Address is required for geocoding',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    // Simulate geocoding
    const lat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const lng = -74.006 + (Math.random() - 0.5) * 0.1;

    return {
      success: true,
      data: {
        latitude: lat,
        longitude: lng,
        address,
        message: `Geocoded address: ${address}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleReverseGeocode(
    input: MapsInput,
    startTime: number,
  ): Promise<StructuredToolResult<MapsOutput>> {
    const { latitude, longitude } = input;

    if (latitude === undefined || longitude === undefined) {
      return {
        success: false,
        error: 'Latitude and longitude are required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    // Simulate reverse geocoding
    const address = `${Math.abs(latitude).toFixed(4)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(4)}°${longitude >= 0 ? 'E' : 'W'}`;

    return {
      success: true,
      data: {
        latitude,
        longitude,
        address,
        message: 'Reverse geocoded successfully',
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleDirections(
    input: MapsInput,
    startTime: number,
  ): Promise<StructuredToolResult<MapsOutput>> {
    const { origin, destination, mode = 'driving' } = input;

    if (!origin || !destination) {
      return {
        success: false,
        error: 'Origin and destination are required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    // Simulate directions
    const distance = Math.floor(Math.random() * 50) + 1;
    const duration = Math.floor(Math.random() * 60) + 10;

    return {
      success: true,
      data: {
        distance,
        duration,
        message: `Directions from ${origin} to ${destination}: ${distance}km, ~${duration}min by ${mode}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleSearch(
    input: MapsInput,
    startTime: number,
  ): Promise<StructuredToolResult<MapsOutput>> {
    const { query } = input;

    if (!query) {
      return {
        success: false,
        error: 'Query is required for place search',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    // Simulate place search
    const results = [
      {
        name: `${query} - Location 1`,
        address: '123 Main St, City, State',
        latitude: 40.7128,
        longitude: -74.006,
      },
      {
        name: `${query} - Location 2`,
        address: '456 Oak Ave, City, State',
        latitude: 40.758,
        longitude: -73.9855,
      },
    ];

    return {
      success: true,
      data: {
        results,
        message: `Found ${results.length} result(s) for "${query}"`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleDistance(
    input: MapsInput,
    startTime: number,
  ): Promise<StructuredToolResult<MapsOutput>> {
    const { origin, destination } = input;

    if (!origin || !destination) {
      return {
        success: false,
        error: 'Origin and destination are required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    // Simulate distance calculation
    const distance = Math.floor(Math.random() * 100) + 1;

    return {
      success: true,
      data: {
        distance,
        message: `Distance from ${origin} to ${destination}: ${distance}km`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }
}
