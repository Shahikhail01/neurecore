// ─── core/index.ts ───────────────────────────────────────────────────────────
// Barrel exports for the entire core layer.
// Import from '@/core' instead of deep paths in feature code.

// Infrastructure singletons
export { tokenManager } from './infrastructure/auth/TokenManager';
export { cacheManager } from './infrastructure/cache/CacheManager';
export { localStore } from './infrastructure/storage/LocalStorageManager';
export { errorHandler } from './infrastructure/ErrorHandler';
export { hqEventBus } from './infrastructure/socket/EventBus';
export type { HQSocketEvents } from './infrastructure/socket/EventBus';

// API client
export { restClient } from './services/api/clients/RestClient';
export { responseTransformer } from './services/api/transformers/ResponseTransformer';

// Adapters
export { agentAdapter } from './services/api/adapters/AgentAdapter';
export { workflowAdapter } from './services/api/adapters/WorkflowAdapter';
export { taskAdapter } from './services/api/adapters/TaskAdapter';
export { departmentAdapter } from './services/api/adapters/DepartmentAdapter';

// Repositories
export { agentRepository } from './repositories/AgentRepository';
export { workflowRepository } from './repositories/WorkflowRepository';
export { taskRepository } from './repositories/TaskRepository';
export { departmentRepository } from './repositories/DepartmentRepository';
