/**
 * Collection Registry & Metadata Service
 * Adapted from NocoBase's CollectionManager
 * Centralized metadata management for all application collections
 */

"use client";

export interface CollectionMetadata {
  name: string;
  title: string;
  description?: string;
  resource: string;
  primaryKey: string;
  fields: {
    name: string;
    type: string;
    title?: string;
    sortable?: boolean;
    filterable?: boolean;
    searchable?: boolean;
    required?: boolean;
  }[];
  actions: string[];
  permissions?: {
    canCreate?: boolean;
    canRead?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
  };
}

export class CollectionRegistry {
  private collections: Map<string, CollectionMetadata> = new Map();

  /**
   * Register a collection with metadata
   */
  register(metadata: CollectionMetadata): void {
    this.collections.set(metadata.name, metadata);
  }

  /**
   * Get collection metadata by name
   */
  get(name: string): CollectionMetadata | undefined {
    return this.collections.get(name);
  }

  /**
   * Get all registered collections
   */
  getAll(): CollectionMetadata[] {
    return Array.from(this.collections.values());
  }

  /**
   * Check if collection exists
   */
  has(name: string): boolean {
    return this.collections.has(name);
  }

  /**
   * Get field metadata for a collection
   */
  getField(
    collectionName: string,
    fieldName: string,
  ): CollectionMetadata["fields"][0] | undefined {
    const collection = this.get(collectionName);
    return collection?.fields.find((f) => f.name === fieldName);
  }

  /**
   * Get sortable fields for a collection
   */
  getSortableFields(collectionName: string): string[] {
    const collection = this.get(collectionName);
    return (collection?.fields || [])
      .filter((f) => f.sortable !== false)
      .map((f) => f.name);
  }

  /**
   * Get filterable fields for a collection
   */
  getFilterableFields(collectionName: string): string[] {
    const collection = this.get(collectionName);
    return (collection?.fields || [])
      .filter((f) => f.filterable !== false)
      .map((f) => f.name);
  }

  /**
   * Get searchable fields for a collection
   */
  getSearchableFields(collectionName: string): string[] {
    const collection = this.get(collectionName);
    return (collection?.fields || [])
      .filter((f) => f.searchable !== false)
      .map((f) => f.name);
  }

  /**
   * Get display field (human-readable name field)
   */
  getDisplayField(collectionName: string): string {
    const collection = this.get(collectionName);
    const stringField = collection?.fields.find((f) => f.type === "string");
    return stringField?.name || "id";
  }

  /**
   * Get primary key for a collection
   */
  getPrimaryKey(collectionName: string): string {
    return this.get(collectionName)?.primaryKey || "id";
  }

  /**
   * Get API resource URL for a collection
   */
  getResource(collectionName: string): string {
    return this.get(collectionName)?.resource || `/api/v1/${collectionName}`;
  }

  /**
   * Check if an action is allowed on a collection
   */
  canAction(
    collectionName: string,
    action: "create" | "read" | "update" | "delete",
  ): boolean {
    const collection = this.get(collectionName);
    if (!collection) return false;

    const permissionKey = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
    const permission =
      collection.permissions?.[
        permissionKey as keyof typeof collection.permissions
      ];

    // Default to true if not explicitly set
    return permission !== false;
  }

  /**
   * Get all collections for a given resource
   */
  getCollectionsByResource(resource: string): CollectionMetadata[] {
    return Array.from(this.collections.values()).filter(
      (c) => c.resource === resource,
    );
  }

  /**
   * Export all metadata as JSON
   */
  export(): Record<string, CollectionMetadata> {
    const result: Record<string, CollectionMetadata> = {};
    this.collections.forEach((metadata, name) => {
      result[name] = metadata;
    });
    return result;
  }

  /**
   * Import metadata from JSON
   */
  import(data: Record<string, CollectionMetadata>): void {
    Object.entries(data).forEach(([name, metadata]) => {
      this.register(metadata);
    });
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.collections.clear();
  }
}

// Global singleton instance
export const collectionRegistry = new CollectionRegistry();

// Pre-register core collections
collectionRegistry.register({
  name: "agents",
  title: "Agents",
  description: "AI agents in the system",
  resource: "/api/v1/agents",
  primaryKey: "id",
  fields: [
    { name: "id", type: "string", title: "ID" },
    { name: "name", type: "string", title: "Agent Name", searchable: true },
    { name: "description", type: "string", title: "Description" },
    { name: "status", type: "string", title: "Status", filterable: true },
    { name: "type", type: "string", title: "Type", filterable: true },
    { name: "config", type: "json", title: "Configuration" },
    {
      name: "createdAt",
      type: "datetime",
      title: "Created At",
      sortable: true,
    },
    {
      name: "updatedAt",
      type: "datetime",
      title: "Updated At",
      sortable: true,
    },
  ],
  actions: ["list", "create", "read", "update", "delete"],
  permissions: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  },
});

collectionRegistry.register({
  name: "tasks",
  title: "Tasks",
  description: "Tasks assigned to agents",
  resource: "/api/v1/tasks",
  primaryKey: "id",
  fields: [
    { name: "id", type: "string", title: "ID" },
    { name: "title", type: "string", title: "Title", searchable: true },
    { name: "description", type: "string", title: "Description" },
    { name: "status", type: "string", title: "Status", filterable: true },
    { name: "priority", type: "string", title: "Priority", filterable: true },
    { name: "assignedAgent", type: "string", title: "Assigned Agent" },
    { name: "dueDate", type: "datetime", title: "Due Date", sortable: true },
    {
      name: "createdAt",
      type: "datetime",
      title: "Created At",
      sortable: true,
    },
    {
      name: "updatedAt",
      type: "datetime",
      title: "Updated At",
      sortable: true,
    },
  ],
  actions: ["list", "create", "read", "update", "delete"],
  permissions: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  },
});

collectionRegistry.register({
  name: "approvals",
  title: "Approvals",
  description: "Approval requests and workflows",
  resource: "/api/v1/approvals",
  primaryKey: "id",
  fields: [
    { name: "id", type: "string", title: "ID" },
    { name: "title", type: "string", title: "Title", searchable: true },
    { name: "status", type: "string", title: "Status", filterable: true },
    { name: "requestedBy", type: "string", title: "Requested By" },
    { name: "approvers", type: "json", title: "Approvers" },
    { name: "dueDate", type: "datetime", title: "Due Date", sortable: true },
    {
      name: "createdAt",
      type: "datetime",
      title: "Created At",
      sortable: true,
    },
    { name: "completedAt", type: "datetime", title: "Completed At" },
  ],
  actions: ["list", "create", "read", "update", "delete"],
  permissions: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
  },
});

export default CollectionRegistry;
