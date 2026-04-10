/**
 * NocoBase Controller
 *
 * REST endpoints for NocoBase system management
 * - Plugin status and configuration
 * - Schema management
 * - Collection management
 */

import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { NocoBaseInitService } from './nocobase-init.service';

@Controller('nocobase')
export class NocoBaseController {
  private readonly logger = new Logger(NocoBaseController.name);

  constructor(private readonly nocobaseInit: NocoBaseInitService) {}

  /**
   * GET /api/nocobase/status
   * Get NocoBase initialization status and plugin list
   */
  @Get('status')
  getStatus() {
    return this.nocobaseInit.getStatus();
  }

  /**
   * GET /api/nocobase/plugins
   * Get list of all registered plugins
   */
  @Get('plugins')
  getPlugins() {
    return {
      plugins: this.nocobaseInit.getRegisteredPlugins(),
      count: this.nocobaseInit.getRegisteredPlugins().length,
    };
  }

  /**
   * GET /api/nocobase/plugins/:name
   * Get specific plugin information
   */
  @Get('plugins/:name')
  getPlugin(name: string) {
    const plugin = this.nocobaseInit.getPlugin(name);
    if (!plugin) {
      return { error: `Plugin ${name} not found` };
    }
    return plugin;
  }

  /**
   * POST /api/nocobase/initialize
   * Initialize NocoBase system
   */
  @Post('initialize')
  async initialize(@Body() options?: any) {
    try {
      await this.nocobaseInit.initialize(options);
      return {
        success: true,
        message: 'NocoBase system initialized',
        status: this.nocobaseInit.getStatus(),
      };
    } catch (error) {
      this.logger.error('Initialization failed', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * POST /api/nocobase/plugins/:name/enable
   * Enable a specific plugin
   */
  @Post('plugins/:name/enable')
  enablePlugin(name: string) {
    this.nocobaseInit.setPluginEnabled(name, true);
    return {
      success: true,
      plugin: this.nocobaseInit.getPlugin(name),
    };
  }

  /**
   * POST /api/nocobase/plugins/:name/disable
   * Disable a specific plugin
   */
  @Post('plugins/:name/disable')
  disablePlugin(name: string) {
    this.nocobaseInit.setPluginEnabled(name, false);
    return {
      success: true,
      plugin: this.nocobaseInit.getPlugin(name),
    };
  }
}
