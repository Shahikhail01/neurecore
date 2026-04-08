# Technical Implementation Guide: NocoDB Hybrid Integration

**Date**: April 7, 2026  
**Audience**: Engineering Team, Architects  
**Scope**: Detailed technical approach, code patterns, architecture, examples

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Phase 2: Backend API Layer Integration](#phase-2-backend-api-layer-integration)
3. [Phase 3: Frontend Infrastructure Setup](#phase-3-frontend-infrastructure-setup)
4. [Phase 4: Component Migration Patterns](#phase-4-component-migration-patterns)
5. [NocoDB Schema Design](#nocobase-schema-design)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Strategy](#deployment-strategy)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Architecture Overview

### System Layers

```
┌──────────────────────────────────────────────────────┐
│                 Presentation Layer                   │
│  (React Components + Next.js Pages)                  │
├──────────────────────────────────────────────────────┤
│              State Management Layer                  │
│  (Zustand stores + NocoDB form context)              │
├──────────────────────────────────────────────────────┤
│              Service/Hook Layer                      │
│  (useAuth, useApi, custom hooks)                     │
├──────────────────────────────────────────────────────┤
│          Repository/API Client Layer                 │
│  (AgentRepository, TaskRepository)                   │
│  (NocoDB SDK wrapper + custom endpoints)             │
├──────────────────────────────────────────────────────┤
│            Backend Business Logic Layer              │
│  (AgentService, TaskService, ApprovalService)        │
├──────────────────────────────────────────────────────┤
│                Database Access Layer                 │
│  (NocoDB collections + custom queries)               │
├──────────────────────────────────────────────────────┤
│                  Persistence Layer                   │
│  (PostgreSQL + NocoDB)                               │
└──────────────────────────────────────────────────────┘
```

### Data Flow Example: Create Agent

```
React Component (AgentForm.tsx)
        │
        ↓ onClick("Save")
Zustand Action (agentStore.createAgent)
        │
        ↓ call()
API Hook (useAgentApi.create)
        │
        ↓ POST /agents
Backend Service (AgentService.create)
        │
        ├─ Validate input
        ├─ Create in NocoDB
        ├─ Emit event
        └─ Return response
        │
        ↓
Repository (AgentRepository.create)
        │
        ├─ NocoDB SDK
        │  .db.collection('agents')
        │  .repository()
        │  .create()
        │
        └─ Result back to component
Zustand Updates (agentStore.agents += new)
        │
        ↓
Component Re-render with new agent
```

### Dependency Injection Strategy

```
// Backend initialization
const app = new Application()

// 1. Core services from NocoDB
const noco = app.get(NocoDB) // from NocoDB framework
const auth = app.get(AuthManager)
const acl = app.get(ACLService)

// 2. NeureCore domain services wrap NocoDB
const agentService = new AgentService(noco, auth, eventBus)
const taskService = new TaskService(noco, agentService, costService)
const approvalService = new ApprovalService(noco, taskService)

// 3. Register in container
app.set('agentService', agentService)
app.set('taskService', taskService)
// ...

// 4. Controllers use services
app.get('/agents', async (ctx) => {
  const service = ctx.app.get('agentService')
  ctx.body = await service.getAgents(ctx.state.tenantId)
})
```

---

## Phase 2: Backend API Layer Integration

### 2.1 Service Layer Architecture

Each NeureCore domain gets a Service class that wraps NocoDB collections:

```typescript
// packages/core/server/src/services/base.service.ts
import { NocoDB } from "@nocobase/sdk";
import { EventEmitter } from "eventemitter3";

export abstract class BaseService<T> {
  protected collection: string;

  constructor(
    protected noco: NocoDB,
    protected eventBus: EventEmitter,
  ) {}

  protected async getRepository(tenantId: string) {
    return this.noco.db.collection(this.collection).repository({ tenantId });
  }

  async create(tenantId: string, data: any): Promise<T> {
    const repo = await this.getRepository(tenantId);
    const created = await repo.create(data);
    this.eventBus.emit(`${this.collection}:created`, created);
    return this.mapFromNocoDB(created);
  }

  async findById(tenantId: string, id: string): Promise<T | null> {
    const repo = await this.getRepository(tenantId);
    const found = await repo.findById(id);
    return found ? this.mapFromNocoDB(found) : null;
  }

  async update(tenantId: string, id: string, data: any): Promise<T> {
    const repo = await this.getRepository(tenantId);
    const updated = await repo.update(id, data);
    this.eventBus.emit(`${this.collection}:updated`, id, data);
    return this.mapFromNocoDB(updated);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const repo = await this.getRepository(tenantId);
    await repo.delete(id);
    this.eventBus.emit(`${this.collection}:deleted`, id);
  }

  async find(tenantId: string, filter: any = {}): Promise<T[]> {
    const repo = await this.getRepository(tenantId);
    const items = await repo.find({ filter });
    return items.map((i) => this.mapFromNocoDB(i));
  }

  protected abstract mapFromNocoDB(noco: any): T;
}
```

### 2.2 Agent Service Example

```typescript
// packages/core/server/src/services/agent.service.ts
import { BaseService } from "./base.service";
import { EventEmitter } from "eventemitter3";
import { NocoDB } from "@nocobase/sdk";

export interface Agent {
  id: string;
  name: string;
  status: "SLEEPING" | "ACTIVE" | "BUSY" | "FAILED";
  mood: number; // 0-100
  version: number;
  configSnapshot: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentInput {
  name: string;
  status?: "SLEEPING" | "ACTIVE";
  mood?: number;
  configSnapshot: Record<string, any>;
  createdBy: string;
}

export interface UpdateAgentInput {
  name?: string;
  status?: string;
  mood?: number;
  configSnapshot?: Record<string, any>;
}

export class AgentService extends BaseService<Agent> {
  collection = "agents";

  constructor(
    noco: NocoDB,
    eventBus: EventEmitter,
    private costService: CostService,
  ) {
    super(noco, eventBus);
  }

  // Override create for agent-specific logic
  async create(tenantId: string, input: CreateAgentInput): Promise<Agent> {
    // Validation
    if (!input.name || input.name.trim().length === 0) {
      throw new Error("Agent name is required");
    }

    // Default values
    const data = {
      name: input.name,
      status: input.status || "SLEEPING",
      mood: input.mood != null ? Math.max(0, Math.min(100, input.mood)) : 50,
      config_snapshot: input.configSnapshot,
      created_by: input.createdBy,
      created_at: new Date(),
      version: 1,
    };

    // Create
    const repo = await this.getRepository(tenantId);
    const created = await repo.create(data);
    const agent = this.mapFromNocoDB(created);

    // Emit event
    this.eventBus.emit("agent:created", agent);

    // Log audit
    await this.costService.logAgentCreation(tenantId, agent.id);

    return agent;
  }

  // Agent-specific: Update mood with bounds checking
  async updateMood(
    tenantId: string,
    agentId: string,
    mood: number,
  ): Promise<Agent> {
    const bounded = Math.max(0, Math.min(100, mood));

    const updated = await this.update(tenantId, agentId, {
      mood: bounded,
      updated_at: new Date(),
    });

    // Side effect: Log mood change for analytics
    this.eventBus.emit("agent:mood-updated", {
      agentId,
      previousMood: updated.mood,
      newMood: bounded,
      timestamp: new Date(),
    });

    return { ...updated, mood: bounded };
  }

  // Agent-specific: Get versions
  async getVersions(tenantId: string, agentId: string) {
    const repo = await this.getRepository(tenantId);
    const versions = await repo.find({
      filter: { agent_id: agentId },
      sort: [{ version: "desc" }],
    });

    return versions.map((v) => ({
      version: v.version,
      configSnapshot: v.config_snapshot,
      createdAt: v.created_at,
      createdBy: v.created_by,
    }));
  }

  // Agent-specific: Rollback to version
  async rollbackToVersion(
    tenantId: string,
    agentId: string,
    targetVersion: number,
  ): Promise<Agent> {
    // Find version
    const repo = await this.getRepository(tenantId);
    const versions = await repo.find({
      filter: {
        agent_id: agentId,
        version: targetVersion,
      },
    });

    if (versions.length === 0) {
      throw new Error(
        `Version ${targetVersion} not found for agent ${agentId}`,
      );
    }

    const targetSnapshot = versions[0].config_snapshot;

    // Update current agent config
    const updated = await this.update(tenantId, agentId, {
      config_snapshot: targetSnapshot,
      version: targetVersion,
      updated_at: new Date(),
    });

    this.eventBus.emit("agent:rolled-back", {
      agentId,
      toVersion: targetVersion,
      timestamp: new Date(),
    });

    return updated;
  }

  protected mapFromNocoDB(noco: any): Agent {
    return {
      id: noco.id,
      name: noco.name,
      status: noco.status,
      mood: noco.mood,
      version: noco.version || 1,
      configSnapshot: noco.config_snapshot || {},
      createdBy: noco.created_by,
      createdAt: new Date(noco.created_at),
      updatedAt: noco.updated_at ? new Date(noco.updated_at) : new Date(),
    };
  }
}
```

### 2.3 Task Service Example

```typescript
// packages/core/server/src/services/task.service.ts
import { BaseService } from "./base.service";

export interface Task {
  id: string;
  title: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  agentId: string;
  agentName: string;
  description?: string;
  startedAt?: Date;
  completedAt?: Date;
  executionCost?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TaskService extends BaseService<Task> {
  collection = "tasks";

  constructor(
    noco: NocoDB,
    eventBus: EventEmitter,
    private agentService: AgentService,
    private costService: CostService,
    private approvalService: ApprovalService,
  ) {
    super(noco, eventBus);
  }

  async create(tenantId: string, input: any): Promise<Task> {
    // Validation
    if (!input.title) throw new Error("Task title required");

    // Get agent (verify it exists)
    const agent = await this.agentService.findById(tenantId, input.agentId);
    if (!agent) throw new Error(`Agent ${input.agentId} not found`);

    const data = {
      title: input.title,
      description: input.description || "",
      status: "PENDING",
      agent_id: input.agentId,
      agent_name: agent.name,
      created_at: new Date(),
      updated_at: new Date(),
      execution_cost: 0,
    };

    const repo = await this.getRepository(tenantId);
    const created = await repo.create(data);
    const task = this.mapFromNocoDB(created);

    this.eventBus.emit("task:created", task);

    return task;
  }

  async startTask(tenantId: string, taskId: string): Promise<Task> {
    const task = await this.findById(tenantId, taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.status !== "PENDING") {
      throw new Error(`Cannot start task with status ${task.status}`);
    }

    const updated = await this.update(tenantId, taskId, {
      status: "IN_PROGRESS",
      started_at: new Date(),
      updated_at: new Date(),
    });

    this.eventBus.emit("task:started", updated);

    return updated;
  }

  async completeTask(
    tenantId: string,
    taskId: string,
    result?: any,
  ): Promise<Task> {
    const task = await this.findById(tenantId, taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    // Calculate execution cost
    const executionCost = await this.costService.calculateTaskCost(
      tenantId,
      task.agentId,
      task.startedAt!,
      new Date(),
    );

    const updated = await this.update(tenantId, taskId, {
      status: "COMPLETED",
      completed_at: new Date(),
      execution_cost: executionCost,
      result: result ? JSON.stringify(result) : null,
      updated_at: new Date(),
    });

    // Record cost
    await this.costService.recordTaskCost(
      tenantId,
      taskId,
      task.agentId,
      executionCost,
    );

    // Trigger downstream processes
    this.eventBus.emit("task:completed", updated);

    // Check if approval needed
    const requiresApproval = await this.approvalService.checkIfApprovalNeeded(
      tenantId,
      taskId,
    );
    if (requiresApproval) {
      await this.approvalService.createApprovalRequest(tenantId, taskId);
    }

    return updated;
  }

  async getTasksByStatus(
    tenantId: string,
    status: Task["status"],
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ items: Task[]; total: number }> {
    const repo = await this.getRepository(tenantId);
    const [items, total] = await Promise.all([
      repo.find({
        filter: { status },
        limit,
        offset,
        sort: [{ created_at: "desc" }],
      }),
      repo.count({ filter: { status } }),
    ]);

    return {
      items: items.map((i) => this.mapFromNocoDB(i)),
      total,
    };
  }

  protected mapFromNocoDB(noco: any): Task {
    return {
      id: noco.id,
      title: noco.title,
      status: noco.status,
      agentId: noco.agent_id,
      agentName: noco.agent_name,
      description: noco.description,
      startedAt: noco.started_at ? new Date(noco.started_at) : undefined,
      completedAt: noco.completed_at ? new Date(noco.completed_at) : undefined,
      executionCost: noco.execution_cost || 0,
      createdAt: new Date(noco.created_at),
      updatedAt: new Date(noco.updated_at),
    };
  }
}
```

### 2.4 Controller Patterns

```typescript
// packages/core/server/src/controllers/agent.controller.ts
import { Router } from "@koa/router";

export function createAgentRoutes(app: any) {
  const router = new Router({
    prefix: "/api/v1/agents",
  });

  const agentService = app.get("agentService");

  // GET /api/v1/agents
  router.get("/", async (ctx) => {
    try {
      const { page = 1, limit = 50 } = ctx.query;
      const tenantId = ctx.state.tenantId;
      const offset = (page - 1) * limit;

      const agents = await agentService.find(tenantId, {
        offset,
        limit,
      });

      ctx.body = {
        success: true,
        data: agents,
        meta: {
          pagination: { page, limit, total: agents.length },
        },
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: {
          code: "AGENT_LIST_ERROR",
          message: error.message,
        },
      };
    }
  });

  // POST /api/v1/agents
  router.post("/", async (ctx) => {
    try {
      const tenantId = ctx.state.tenantId;
      const userId = ctx.state.user.id;

      const agent = await agentService.create(tenantId, {
        ...ctx.request.body,
        createdBy: userId,
      });

      ctx.status = 201;
      ctx.body = {
        success: true,
        data: agent,
      };
    } catch (error) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: {
          code: "AGENT_CREATE_ERROR",
          message: error.message,
        },
      };
    }
  });

  // PATCH /api/v1/agents/:id
  router.patch("/:id", async (ctx) => {
    try {
      const tenantId = ctx.state.tenantId;
      const { id } = ctx.params;

      const updated = await agentService.update(tenantId, id, ctx.request.body);

      ctx.body = {
        success: true,
        data: updated,
      };
    } catch (error) {
      ctx.status = error.message.includes("not found") ? 404 : 400;
      ctx.body = {
        success: false,
        error: {
          code: "AGENT_UPDATE_ERROR",
          message: error.message,
        },
      };
    }
  });

  // DELETE /api/v1/agents/:id
  router.delete("/:id", async (ctx) => {
    try {
      const tenantId = ctx.state.tenantId;
      const { id } = ctx.params;

      await agentService.delete(tenantId, id);

      ctx.status = 204;
      ctx.body = null;
    } catch (error) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: {
          code: "AGENT_DELETE_ERROR",
          message: error.message,
        },
      };
    }
  });

  return router;
}
```

---

## Phase 3: Frontend Infrastructure Setup

### 3.1 Zustand Store Architecture

```typescript
// frontend-tenant/src/stores/agentStore.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createSelectors } from "@/lib/store-utils";
import { Agent } from "@/shared/types";
import { agentApi } from "@/api/agent-api";

interface AgentState {
  // State
  agents: Agent[];
  selectedAgentId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchAgents: (page?: number) => Promise<void>;
  getAgent: (id: string) => Promise<Agent | null>;
  createAgent: (data: Partial<Agent>) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<Agent>) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  selectAgent: (id: string) => void;
  updateMood: (id: string, mood: number) => Promise<void>;
  clearError: () => void;
}

const useAgentStoreBase = create<AgentState>()(
  immer((set, get) => ({
    agents: [],
    selectedAgentId: null,
    loading: false,
    error: null,

    fetchAgents: async (page = 1) => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        const response = await agentApi.list({ page, limit: 50 });
        set((state) => {
          state.agents = response.data;
          state.loading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = String(error);
          state.loading = false;
        });
        throw error;
      }
    },

    getAgent: async (id: string) => {
      try {
        const agent = await agentApi.get(id);
        set((state) => {
          const existing = state.agents.find((a) => a.id === id);
          if (existing) {
            Object.assign(existing, agent);
          } else {
            state.agents.push(agent);
          }
        });
        return agent;
      } catch (error) {
        set((state) => {
          state.error = String(error);
        });
        throw error;
      }
    },

    createAgent: async (data) => {
      try {
        const agent = await agentApi.create(data);
        set((state) => {
          state.agents.push(agent);
        });
        return agent;
      } catch (error) {
        set((state) => {
          state.error = String(error);
        });
        throw error;
      }
    },

    updateAgent: async (id, data) => {
      try {
        const updated = await agentApi.update(id, data);
        set((state) => {
          const agent = state.agents.find((a) => a.id === id);
          if (agent) {
            Object.assign(agent, updated);
          }
        });
        return updated;
      } catch (error) {
        set((state) => {
          state.error = String(error);
        });
        throw error;
      }
    },

    deleteAgent: async (id) => {
      try {
        await agentApi.delete(id);
        set((state) => {
          state.agents = state.agents.filter((a) => a.id !== id);
          if (state.selectedAgentId === id) {
            state.selectedAgentId = null;
          }
        });
      } catch (error) {
        set((state) => {
          state.error = String(error);
        });
        throw error;
      }
    },

    selectAgent: (id) => {
      set((state) => {
        state.selectedAgentId = id;
      });
    },

    updateMood: async (id, mood) => {
      try {
        const updated = await agentApi.updateMood(id, mood);
        set((state) => {
          const agent = state.agents.find((a) => a.id === id);
          if (agent) {
            agent.mood = updated.mood;
          }
        });
      } catch (error) {
        set((state) => {
          state.error = String(error);
        });
        throw error;
      }
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },
  })),
);

// Create selectors for performance optimization
export const useAgentStore = createSelectors(useAgentStoreBase);

// Example selectors:
// useAgentStore.use.agents()
// useAgentStore.use.selectedAgent()
// useAgentStore.use.loading()
// useAgentStore.use.error()
```

### 3.2 API Client Layer

```typescript
// frontend-tenant/src/api/agent-api.ts
import { apiClient } from "@/lib/api-client";
import { Agent } from "@/shared/types";

export const agentApi = {
  async list(params: { page: number; limit: number }) {
    const response = await apiClient.get("/agents", {
      params: {
        page: params.page,
        limit: params.limit,
      },
    });
    return response.data.data;
  },

  async get(id: string): Promise<Agent> {
    const response = await apiClient.get(`/agents/${id}`);
    return response.data.data;
  },

  async create(data: Partial<Agent>): Promise<Agent> {
    const response = await apiClient.post("/agents", data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Agent>): Promise<Agent> {
    const response = await apiClient.patch(`/agents/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/agents/${id}`);
  },

  async updateMood(id: string, mood: number): Promise<Agent> {
    const response = await apiClient.patch(`/agents/${id}`, { mood });
    return response.data.data;
  },

  async getVersions(id: string) {
    const response = await apiClient.get(`/agents/${id}/versions`);
    return response.data.data;
  },

  async rollback(id: string, version: number): Promise<Agent> {
    const response = await apiClient.post(`/agents/${id}/rollback`, {
      version,
    });
    return response.data.data;
  },
};
```

### 3.3 API Interceptor Setup

```typescript
// frontend-tenant/src/lib/api-client.ts
import axios, { AxiosInstance, AxiosError } from "axios";
import { useAuthStore } from "@/stores/authStore";

let refreshTokenMutex: Promise<string> | null = null;

export const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1",
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor: Add token
  client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor: Handle 401 + refresh token
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          // Prevent concurrent refresh calls with mutex
          if (!refreshTokenMutex) {
            refreshTokenMutex = refreshAuthToken();
          }

          const newToken = await refreshTokenMutex;

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } catch (refreshError) {
          // Refresh failed: redirect to login
          useAuthStore.getState().logout();
          window.location.href = "/login";
          return Promise.reject(refreshError);
        } finally {
          refreshTokenMutex = null;
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
};

async function refreshAuthToken(): Promise<string> {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
  });

  try {
    const refreshToken = useAuthStore.getState().refreshToken;
    const response = await client.post("/auth/refresh", {
      refreshToken,
    });

    const newToken = response.data.data.token;
    useAuthStore.getState().setToken(newToken);
    return newToken;
  } catch (error) {
    throw new Error("Token refresh failed");
  }
}

export const apiClient = createApiClient();
```

### 3.4 Error Handler

```typescript
// frontend-tenant/src/lib/error-handler.ts
import { AxiosError } from "axios";

export interface AppError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

export const handleError = (error: unknown): AppError => {
  // Network error
  if (error instanceof Error && error.message === "Network Error") {
    return {
      code: "NETWORK_ERROR",
      message: "Unable to connect to server. Check your internet connection.",
      statusCode: 0,
    };
  }

  // Axios error
  if (error instanceof AxiosError) {
    const status = error.response?.status || 500;
    const data = error.response?.data as any;

    return {
      code: data?.error?.code || `HTTP_${status}`,
      message: data?.error?.message || error.message,
      details: data?.error?.details,
      statusCode: status,
    };
  }

  // Generic error
  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
      statusCode: 500,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred",
    statusCode: 500,
  };
};

export const showErrorNotification = (error: AppError) => {
  // Hook into notification system (toast, alert, etc)
  console.error(`[${error.code}] ${error.message}`, error.details);
  // TODO: Call useNotificationStore or similar
};
```

---

## Phase 4: Component Migration Patterns

### 4.1 Generic Agent List Component

```typescript
// frontend-tenant/src/components/agents/AgentList.tsx
'use client'

import { useEffect } from 'react'
import { useAgentStore } from '@/stores/agentStore'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { AgentCard } from './AgentCard'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface AgentListProps {
  onAgentSelect?: (id: string) => void
}

export function AgentList({ onAgentSelect }: AgentListProps) {
  const agents = useAgentStore.use.agents()
  const loading = useAgentStore.use.loading()
  const error = useAgentStore.use.error()
  const fetchAgents = useAgentStore.use.fetchAgents()
  const clearError = useAgentStore.use.clearError()
  const { handleError } = useErrorHandler()

  useEffect(() => {
    fetchAgents(1).catch(handleError)
  }, [])

  if (loading) {
    return <LoadingSpinner text="Loading agents..." />
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => {
            clearError()
            fetchAgents(1)
          }}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No agents found
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onSelect={() => onAgentSelect?.(agent.id)}
        />
      ))}
    </div>
  )
}
```

### 4.2 Agent Detail View Component

```typescript
// frontend-tenant/src/components/agents/AgentDetailView.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAgentStore } from '@/stores/agentStore'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { Agent } from '@/shared/types'
import { Gauge } from '@/components/ui/gauge'

interface AgentDetailViewProps {
  agentId: string
}

export function AgentDetailView({ agentId }: AgentDetailViewProps) {
  const agent = useAgentStore((s) =>
    s.agents.find((a) => a.id === agentId)
  )
  const getAgent = useAgentStore.use.getAgent()
  const updateMood = useAgentStore.use.updateMood()
  const [mood, setMood] = useState(agent?.mood || 50)
  const [isSaving, setIsSaving] = useState(false)
  const { handleError } = useErrorHandler()

  useEffect(() => {
    if (!agent) {
      getAgent(agentId).catch(handleError)
    } else {
      setMood(agent.mood)
    }
  }, [agentId, agent])

  const handleMoodChange = async (newMood: number) => {
    setMood(newMood)
    setIsSaving(true)

    try {
      await updateMood(agentId, newMood)
    } catch (error) {
      handleError(error)
      // Revert on error
      setMood(agent?.mood || 50)
    } finally {
      setIsSaving(false)
    }
  }

  if (!agent) {
    return <div>Loading agent...</div>
  }

  return (
    <div className="p-6 bg-white rounded-lg border">
      <h2 className="text-2xl font-bold mb-4">{agent.name}</h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-600">Status</p>
          <p className="text-lg font-medium">{agent.status}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Version</p>
          <p className="text-lg font-medium">{agent.version}</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-3">Mood Gauge</p>
        <Gauge
          value={mood}
          onChange={handleMoodChange}
          disabled={isSaving}
        />
      </div>

      {agent.configSnapshot && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Configuration</p>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
            {JSON.stringify(agent.configSnapshot, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
```

---

## NocoDB Schema Design

### Key Collections

#### 1. agents

```yaml
Collection: agents
Fields:
  - id (UUID, primary key)
  - name (TextField, required, unique)
  - status (SingleSelect, options: SLEEPING|ACTIVE|BUSY|FAILED)
  - mood (Number, 0-100, default: 50)
  - version (Number, default: 1)
  - config_snapshot (JSON)
  - created_by (LinkToRecord → users)
  - created_at (DateTime, default: now())
  - updated_at (DateTime, default: now())
  - deleted_at (DateTime, nullable)

Indexes:
  - status_idx
  - created_at_idx
  - deleted_at_idx (soft delete)

Relationships:
  - agent_versions (hasMany)
  - tasks_assigned (hasMany)
```

#### 2. tasks

```yaml
Collection: tasks
Fields:
  - id (UUID, primary key)
  - title (TextField, required)
  - description (LongTextField)
  - status (SingleSelect, PENDING|IN_PROGRESS|COMPLETED|FAILED)
  - agent_id (LinkToRecord → agents, required)
  - agent_name (TextField, denormalized)
  - started_at (DateTime, nullable)
  - completed_at (DateTime, nullable)
  - execution_cost (Decimal)
  - result (JSON)
  - created_at (DateTime, default: now())
  - updated_at (DateTime, default: now())

Indexes:
  - status_idx
  - agent_id_idx
  - created_at_idx

Hooks:
  - on_create: validate agent exists
  - on_update: update execution_cost on completion
```

#### 3. approvals

```yaml
Collection: approvals
Fields:
  - id (UUID, primary key)
  - task_id (LinkToRecord → tasks, required)
  - task_title (TextField, denormalized)
  - status (SingleSelect, PENDING|APPROVED|REJECTED|EXPIRED)
  - priority (SingleSelect, LOW|MEDIUM|HIGH|URGENT)
  - requester_id (LinkToRecord → users)
  - approver_id (LinkToRecord → users, nullable)
  - expires_at (DateTime)
  - approved_at (DateTime, nullable)
  - reason (LongTextField)
  - created_at (DateTime, default: now())
  - updated_at (DateTime, default: now())

Indexes:
  - status_idx
  - task_id_idx
  - expires_at_idx
  - approver_id_idx

Hooks:
  - on_create: set expires_at based on priority (escalation)
```

#### 4. workflows

```yaml
Collection: workflows
Fields:
  - id (UUID, primary key)
  - name (TextField, required)
  - description (LongTextField)
  - definition (JSON, required)
  - status (SingleSelect, ACTIVE|INACTIVE)
  - triggers (JSON)
  - created_by (LinkToRecord → users)
  - created_at (DateTime, default: now())
  - updated_at (DateTime, default: now())

Relationships:
  - workflow_executions (hasMany)
  - workflow_nodes (hasMany)
```

---

## Testing Strategy

### Unit Test Structure

```typescript
// backend/src/services/__tests__/agent.service.spec.ts
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { AgentService } from "../agent.service";
import { EventEmitter } from "eventemitter3";

describe("AgentService", () => {
  let service: AgentService;
  let mockNoco: any;
  let mockEventBus: EventEmitter;

  beforeEach(() => {
    mockNoco = {
      db: {
        collection: jest.fn((name) => ({
          repository: jest.fn(() => ({
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            find: jest.fn(),
          })),
        })),
      },
    };

    mockEventBus = new EventEmitter();
    service = new AgentService(mockNoco, mockEventBus, {} as any);
  });

  describe("create", () => {
    it("should create an agent with valid input", async () => {
      const input = {
        name: "Test Agent",
        configSnapshot: {},
        createdBy: "user-1",
      };

      const created = await service.create("tenant-1", input);

      expect(created).toBeDefined();
      expect(created.name).toBe("Test Agent");
      expect(created.status).toBe("SLEEPING");
      expect(created.mood).toBe(50);
    });

    it("should throw error if name is missing", async () => {
      const input = {
        name: "",
        configSnapshot: {},
        createdBy: "user-1",
      };

      await expect(service.create("tenant-1", input)).rejects.toThrow(
        "Agent name is required",
      );
    });

    it("should emit agent:created event", async () => {
      const input = {
        name: "Test Agent",
        configSnapshot: {},
        createdBy: "user-1",
      };

      const listener = jest.fn();
      mockEventBus.on("agent:created", listener);

      await service.create("tenant-1", input);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("updateMood", () => {
    it("should clamp mood between 0-100", async () => {
      const updated = await service.updateMood("tenant-1", "agent-1", 150);
      expect(updated.mood).toBe(100);

      const updated2 = await service.updateMood("tenant-1", "agent-1", -10);
      expect(updated2.mood).toBe(0);
    });
  });
});
```

### Integration Test Structure

```typescript
// backend/src/services/__tests__/agent-task-integration.spec.ts
describe("Agent-Task Integration", () => {
  let app: Application;
  let agentService: AgentService;
  let taskService: TaskService;
  let noco: NocoDB;

  beforeAll(async () => {
    // Set up test database
    app = new Application();
    noco = await setupTestNocoDB();
    agentService = new AgentService(noco, new EventEmitter(), {} as any);
    taskService = new TaskService(
      noco,
      new EventEmitter(),
      agentService,
      {} as any,
      {} as any,
    );
  });

  afterAll(async () => {
    await teardownTestNocoDB();
  });

  it("should complete task and calculate cost", async () => {
    const tenantId = "tenant-1";

    // Create agent
    const agent = await agentService.create(tenantId, {
      name: "Test Agent",
      configSnapshot: {},
      createdBy: "user-1",
    });

    // Create task
    const task = await taskService.create(tenantId, {
      title: "Test Task",
      agentId: agent.id,
    });

    expect(task.status).toBe("PENDING");

    // Start task
    const started = await taskService.startTask(tenantId, task.id);
    expect(started.status).toBe("IN_PROGRESS");

    // Wait a bit
    await new Promise((r) => setTimeout(r, 100));

    // Complete task
    const completed = await taskService.completeTask(tenantId, task.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.executionCost).toBeGreaterThan(0);
  });
});
```

### E2E Test Structure

```typescript
// e2e/agent-workflow.spec.ts
import { test, expect, Page } from "@playwright/test";

test.describe("Agent Workflow", () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto("http://localhost:3001/agents");
  });

  test("should create agent and view details", async () => {
    // Click create button
    await page.click('button:has-text("Add Agent")');

    // Fill form
    await page.fill('input[name="name"]', "E2E Test Agent");
    await page.click('button:has-text("Create")');

    // Verify created
    await expect(page.locator("text=E2E Test Agent")).toBeVisible();

    // Click to view details
    await page.click("text=E2E Test Agent");

    // Verify details page
    await expect(page.locator("text=Status")).toBeVisible();
  });

  test("should update agent mood", async () => {
    // Navigate to agent
    await page.click("text=Test Agent");

    // Find mood gauge
    const gauge = page.locator('[data-testid="mood-gauge"]');

    // Click on 75% position
    const box = await gauge.boundingBox();
    const x = box!.x + box!.width * 0.75;
    const y = box!.y + box!.height / 2;
    await page.click({ x, y });

    // Verify saved
    await expect(page.locator("text=Mood saved")).toBeVisible();
  });
});
```

---

## Deployment Strategy

### Blue-Green Deployment

```bash
# 1. Deploy new version (green) alongside old (blue)
docker-compose -f docker-compose.blue.yml up -d
docker-compose -f docker-compose.green.yml up -d

# 2. Run smoke tests on green
npm run test:smoke -- http://localhost:3002

# 3. Switch traffic (via load balancer)
docker exec load-balancer \
  update-backend green

# 4. Monitor for 24h

# 5. Keep blue as rollback
# To rollback:
docker exec load-balancer \
  update-backend blue
```

### Database Migration Strategy

```bash
# 1. Backup existing PostgreSQL
pg_dump postgres://user:pass@localhost/neurecore > backup-2026-04-07.sql

# 2. Create NocoDB collections (dry-run)
npm run migrate:collections -- --dry-run

# 3. Migrate data (in transaction)
npm run migrate:data

# 4. Verify data integrity
npm run verify:migration

# 5. If any issues, rollback
psql postgres://user:pass@localhost/neurecore < backup-2026-04-07.sql
```

---

## Troubleshooting Guide

### Common Issues

#### Issue 1: NocoDB collection not found

**Symptom**: `Error: Collection 'agents' not found`
**Solution**:

```typescript
// Check if collection exists
const collections = await noco.db.getCollections()
console.log(collections.map(c => c.title))

// If missing, create it
await noco.db.createCollection({
  title: 'agents',
  fields: [...]
})
```

#### Issue 2: Token refresh infinite loop

**Symptom**: Request gets stuck refreshing token repeatedly
**Solution**:

```typescript
// Check mutex logic in api-client.ts
// Add abort signal to prevent infinite loops
let refreshTokenMutex: Promise<string> | null = null
let abortController = new AbortController()

if (error.response?.status === 401) {
  if (refreshTokenMutex) {
    // Already refreshing
    return refreshTokenMutex.then(token => ...retry)
  }
  // Start refresh
  refreshTokenMutex = doRefresh()
}
```

#### Issue 3: Pagination inconsistency

**Symptom**: Same items appear on multiple pages
**Solution**:

```typescript
// Ensure consistent ordering
await repo.find({
  filter: { deleted_at: null },
  sort: [{ id: "asc" }], // Always sort by ID
  limit: 50,
  offset: page * 50,
});
```

---

**Document version**: 1.0  
**Last updated**: April 7, 2026  
**For**: Engineering Team Implementation
