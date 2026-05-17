/**
 * Schema Component Registry
 * Manages registration and retrieval of schema-based components
 * Adapted from NocoBase's component registration pattern
 */

import React from "react";
import { SchemaComponentEntry } from "../types";

class SchemaComponentRegistry {
  private components: Map<string, SchemaComponentEntry> = new Map();

  /**
   * Register a schema component
   */
  register(
    type: string,
    component: React.ComponentType<any>,
    options?: {
      readPretty?: React.ComponentType<any>;
      props?: Record<string, any>;
    },
  ) {
    this.components.set(type, {
      type,
      component,
      readPretty: options?.readPretty,
      props: options?.props,
    });
  }

  /**
   * Get a registered component
   */
  get(type: string): SchemaComponentEntry | undefined {
    return this.components.get(type);
  }

  /**
   * Get all registered components
   */
  getAll(): Map<string, SchemaComponentEntry> {
    return new Map(this.components);
  }

  /**
   * Check if component is registered
   */
  has(type: string): boolean {
    return this.components.has(type);
  }

  /**
   * Clear all registered components (useful for testing)
   */
  clear(): void {
    this.components.clear();
  }

  /**
   * Get component names
   */
  getNames(): string[] {
    return Array.from(this.components.keys());
  }
}

// Global registry instance
export const schemaComponentRegistry = new SchemaComponentRegistry();

/**
 * Hook to access schema component registry
 */
export function useSchemaComponentRegistry() {
  return schemaComponentRegistry;
}
