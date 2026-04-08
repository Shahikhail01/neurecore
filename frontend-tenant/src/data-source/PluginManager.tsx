/**
 * Plugin System & Extension Management
 * Register, manage, and extend application functionality via plugins
 * Pattern adapted from NocoBase's Plugin.ts and PluginManager.ts
 */

"use client";

import {
  useCallback,
  useMemo,
  useState,
  useContext,
  createContext,
  ReactNode,
  FC,
} from "react";

export type PluginType = "data-source" | "block" | "field" | "schema-initializer" | "custom";

export type PluginPhase = "initializing" | "activated" | "loading" | "error";

export interface PluginOptions {
  id: string;
  name: string;
  version: string;
  description?: string;
  type: PluginType;
  dependencies?: string[];
  async?: boolean;
}

export interface PluginHooks {
  beforeLoad?: () => Promise<void>;
  afterLoad?: () => Promise<void>;
  beforeActivate?: () => Promise<void>;
  afterActivate?: () => Promise<void>;
  beforeUnload?: () => Promise<void>;
  getSchemaInitializers?: () => any;
  getCollectionTemplates?: () => any;
  getFieldInterfaces?: () => any;
}

export interface PluginInstance {
  options: PluginOptions;
  hooks: PluginHooks;
  phase: PluginPhase;
  error?: Error;
  data?: Record<string, any>;
}

/**
 * Base Plugin class
 */
export abstract class Plugin {
  protected options: PluginOptions;
  protected hooks: PluginHooks;

  constructor(options: PluginOptions) {
    this.options = options;
    this.hooks = {};
  }

  /**
   * Get plugin options
   */
  getOptions(): PluginOptions {
    return this.options;
  }

  /**
   * Set plugin hooks
   */
  setHooks(hooks: PluginHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /**
   * Called before plugin load
   */
  async beforeLoad(): Promise<void> {
    if (this.hooks.beforeLoad) {
      await this.hooks.beforeLoad();
    }
  }

  /**
   * Called after plugin load
   */
  async afterLoad(): Promise<void> {
    if (this.hooks.afterLoad) {
      await this.hooks.afterLoad();
    }
  }

  /**
   * Called before plugin activation
   */
  async beforeActivate(): Promise<void> {
    if (this.hooks.beforeActivate) {
      await this.hooks.beforeActivate();
    }
  }

  /**
   * Called after plugin activation
   */
  async afterActivate(): Promise<void> {
    if (this.hooks.afterActivate) {
      await this.hooks.afterActivate();
    }
  }

  /**
   * Called before plugin unload
   */
  async beforeUnload(): Promise<void> {
    if (this.hooks.beforeUnload) {
      await this.hooks.beforeUnload();
    }
  }

  /**
   * Load plugin
   */
  async load(): Promise<void> {
    await this.beforeLoad();
    // Plugin-specific load logic
    await this.afterLoad();
  }

  /**
   * Activate plugin
   */
  async activate(): Promise<void> {
    await this.beforeActivate();
    // Plugin-specific activation logic
    await this.afterActivate();
  }

  /**
   * Unload plugin
   */
  async unload(): Promise<void> {
    await this.beforeUnload();
    // Plugin-specific unload logic
  }
}

/**
 * Plugin manager
 */
export class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private dependencies: Map<string, string[]> = new Map();
  private loadOrder: string[] = [];

  /**
   * Register a plugin
   */
  register(plugin: Plugin): void {
    const options = plugin.getOptions();
    const hooks = (plugin as any).hooks || {};

    const instance: PluginInstance = {
      options,
      hooks,
      phase: "initializing",
    };

    this.plugins.set(options.id, instance);

    if (options.dependencies) {
      this.dependencies.set(options.id, options.dependencies);
    }
  }

  /**
   * Get plugin by ID
   */
  get(id: string): PluginInstance | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all plugins
   */
  getAll(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by type
   */
  getByType(type: PluginType): PluginInstance[] {
    return Array.from(this.plugins.values()).filter(p => p.options.type === type);
  }

  /**
   * Check if plugin is loaded
   */
  isLoaded(id: string): boolean {
    const plugin = this.plugins.get(id);
    return plugin ? plugin.phase !== "initializing" : false;
  }

  /**
   * Check if plugin is active
   */
  isActive(id: string): boolean {
    const plugin = this.plugins.get(id);
    return plugin ? plugin.phase === "activated" : false;
  }

  /**
   * Resolve plugin load order based on dependencies
   */
  private resolveLoadOrder(): string[] {
    const resolved: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected for plugin: ${id}`);
      }

      visiting.add(id);

      const deps = this.dependencies.get(id) || [];
      for (const dep of deps) {
        if (this.plugins.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(id);
      visited.add(id);
      resolved.push(id);
    };

    for (const id of this.plugins.keys()) {
      visit(id);
    }

    return resolved;
  }

  /**
   * Load all plugins in dependency order
   */
  async loadAll(): Promise<void> {
    this.loadOrder = this.resolveLoadOrder();

    for (const id of this.loadOrder) {
      const plugin = this.plugins.get(id);
      if (plugin) {
        try {
          plugin.phase = "loading";
          // Load plugin (would call plugin.load() if Plugin instance is available)
          plugin.phase = "activated";
        } catch (error) {
          plugin.phase = "error";
          plugin.error = error instanceof Error ? error : new Error(String(error));
          console.error(`Failed to load plugin ${id}:`, error);
        }
      }
    }
  }

  /**
   * Unload all plugins in reverse order
   */
  async unloadAll(): Promise<void> {
    const unloadOrder = [...this.loadOrder].reverse();

    for (const id of unloadOrder) {
      const plugin = this.plugins.get(id);
      if (plugin && plugin.phase === "activated") {
        try {
          // Unload plugin (would call plugin.unload() if Plugin instance is available)
          plugin.phase = "initializing";
        } catch (error) {
          console.error(`Failed to unload plugin ${id}:`, error);
        }
      }
    }
  }

  /**
   * Get all schema initializers from loaded plugins
   */
  getSchemaInitializers(): any {
    const initializers: Record<string, any> = {};

    for (const [id, plugin] of this.plugins.entries()) {
      if (plugin.hooks.getSchemaInitializers) {
        initializers[id] = plugin.hooks.getSchemaInitializers();
      }
    }

    return initializers;
  }

  /**
   * Get all collection templates from loaded plugins
   */
  getCollectionTemplates(): any {
    const templates: Record<string, any> = {};

    for (const [id, plugin] of this.plugins.entries()) {
      if (plugin.hooks.getCollectionTemplates) {
        templates[id] = plugin.hooks.getCollectionTemplates();
      }
    }

    return templates;
  }

  /**
   * Get all field interfaces from loaded plugins
   */
  getFieldInterfaces(): any {
    const interfaces: Record<string, any> = {};

    for (const [id, plugin] of this.plugins.entries()) {
      if (plugin.hooks.getFieldInterfaces) {
        interfaces[id] = plugin.hooks.getFieldInterfaces();
      }
    }

    return interfaces;
  }

  /**
   * Export plugin list
   */
  export(): Array<{ id: string; name: string; version: string; type: PluginType; phase: PluginPhase }> {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.options.id,
      name: p.options.name,
      version: p.options.version,
      type: p.options.type,
      phase: p.phase,
    }));
  }
}

// Global plugin manager instance
let globalPluginManager: PluginManager;

/**
 * Get or create global plugin manager
 */
export function getPluginManager(): PluginManager {
  if (!globalPluginManager) {
    globalPluginManager = new PluginManager();
  }
  return globalPluginManager;
}

/**
 * Plugin manager context
 */
const PluginManagerContext = createContext<PluginManager | null>(null);

export interface PluginManagerProviderProps {
  children: ReactNode;
  manager?: PluginManager;
}

/**
 * Plugin manager provider
 */
export const PluginManagerProvider: FC<PluginManagerProviderProps> = ({
  children,
  manager,
}) => {
  const pm = manager || getPluginManager();

  return (
    <PluginManagerContext.Provider value={pm}>
      {children}
    </PluginManagerContext.Provider>
  );
};

/**
 * Hook to use plugin manager
 */
export function usePluginManager(): PluginManager {
  const context = useContext(PluginManagerContext);
  return context || getPluginManager();
}

/**
 * Hook to get plugin
 */
export function usePlugin(id: string): PluginInstance | undefined {
  const manager = usePluginManager();
  const [plugin, setPlugin] = useState<PluginInstance | undefined>();

  useMemo(() => {
    setPlugin(manager.get(id));
  }, [id, manager]);

  return plugin;
}

/**
 * Hook to list plugins
 */
export function usePlugins(type?: PluginType): PluginInstance[] {
  const manager = usePluginManager();

  return useMemo(() => {
    if (type) {
      return manager.getByType(type);
    }
    return manager.getAll();
  }, [manager, type]);
}

/**
 * Hook to check if plugin is loaded
 */
export function useIsPluginLoaded(id: string): boolean {
  const manager = usePluginManager();
  const [loaded, setLoaded] = useState(false);

  useMemo(() => {
    setLoaded(manager.isLoaded(id));
  }, [id, manager]);

  return loaded;
}

/**
 * Hook to check if plugin is active
 */
export function useIsPluginActive(id: string): boolean {
  const manager = usePluginManager();
  const [active, setActive] = useState(false);

  useMemo(() => {
    setActive(manager.isActive(id));
  }, [id, manager]);

  return active;
}

export default PluginManager;
