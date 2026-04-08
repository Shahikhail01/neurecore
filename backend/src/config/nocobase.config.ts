/**
 * NocoDB Configuration
 * Location: src/config/nocobase.config.ts
 */

import { NocoDB } from 'nocodb/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NocoBaseConfig {
  private noco: NocoDB | null = null;

  constructor(private configService: ConfigService) {}

  /**
   * Initialize NocoDB client
   */
  async initialize(): Promise<NocoDB> {
    if (this.noco) {
      return this.noco;
    }

    const baseURL = this.configService.get<string>(
      'NOCO_BASE_URL',
      'http://localhost:8080',
    );
    const token = this.configService.get<string>('NOCO_API_TOKEN', '');

    this.noco = new NocoDB({
      baseURL,
    });

    if (token) {
      await this.noco.auth({
        token,
      });
    } else {
      console.warn(
        'NocoDB token not configured. Some operations may not work.',
      );
    }

    return this.noco;
  }

  /**
   * Get initialized NocoDB client
   */
  getClient(): NocoDB {
    if (!this.noco) {
      throw new Error(
        'NocoDB client not initialized. Call initialize() first.',
      );
    }
    return this.noco;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.noco !== null;
  }

  /**
   * Disconnect from NocoDB (if needed)
   */
  async disconnect(): Promise<void> {
    this.noco = null;
  }
}
