/**
 * Collection Definitions
 * Defines collections and their structure
 */

export interface CollectionField {
  name: string;
  type:
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "datetime"
    | "json"
    | "relation";
  title?: string;
  description?: string;
  required?: boolean;
  defaultValue?: any;
  options?: Record<string, any>;
}

export interface Collection {
  name: string;
  title: string;
  description?: string;
  fields: CollectionField[];
  actions?: string[];
}

// Agents Collection
export const agentsCollection: Collection = {
  name: "agents",
  title: "Agents",
  description: "AI agents in the system",
  fields: [
    { name: "id", type: "string", title: "ID", required: true },
    { name: "name", type: "string", title: "Agent Name", required: true },
    { name: "description", type: "string", title: "Description" },
    {
      name: "status",
      type: "string",
      title: "Status",
      options: { enum: ["active", "inactive", "archived"] },
    },
    { name: "type", type: "string", title: "Type" },
    { name: "config", type: "json", title: "Configuration" },
    { name: "createdAt", type: "datetime", title: "Created At" },
    { name: "updatedAt", type: "datetime", title: "Updated At" },
  ],
  actions: ["list", "create", "read", "update", "delete"],
};

// Tasks Collection
export const tasksCollection: Collection = {
  name: "tasks",
  title: "Tasks",
  description: "Tasks assigned to agents",
  fields: [
    { name: "id", type: "string", title: "ID", required: true },
    { name: "title", type: "string", title: "Title", required: true },
    { name: "description", type: "string", title: "Description" },
    {
      name: "status",
      type: "string",
      title: "Status",
      options: { enum: ["pending", "in_progress", "completed", "failed"] },
    },
    {
      name: "priority",
      type: "string",
      title: "Priority",
      options: { enum: ["high", "medium", "low"] },
    },
    { name: "assignedAgent", type: "string", title: "Assigned Agent" },
    { name: "dueDate", type: "datetime", title: "Due Date" },
    { name: "createdAt", type: "datetime", title: "Created At" },
    { name: "updatedAt", type: "datetime", title: "Updated At" },
  ],
  actions: ["list", "create", "read", "update", "delete"],
};

// Approvals Collection
export const approvalsCollection: Collection = {
  name: "approvals",
  title: "Approvals",
  description: "Approval requests",
  fields: [
    { name: "id", type: "string", title: "ID", required: true },
    { name: "title", type: "string", title: "Title", required: true },
    { name: "description", type: "string", title: "Description" },
    {
      name: "status",
      type: "string",
      title: "Status",
      options: {
        enum: ["pending", "approved", "rejected", "changes_requested"],
      },
    },
    { name: "requestedBy", type: "string", title: "Requested By" },
    { name: "approvedBy", type: "string", title: "Approved By" },
    { name: "comments", type: "string", title: "Comments" },
    { name: "createdAt", type: "datetime", title: "Created At" },
    { name: "updatedAt", type: "datetime", title: "Updated At" },
  ],
  actions: ["list", "create", "read", "update", "delete"],
};

export const collections = [
  agentsCollection,
  tasksCollection,
  approvalsCollection,
];

export function getCollection(name: string): Collection | undefined {
  return collections.find((c) => c.name === name);
}
