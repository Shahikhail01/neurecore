export interface ApiResponse<T = unknown> {
  status: "success" | "error";
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  meta: { timestamp: string; requestId: string };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  tierId?: string;
  tier?: {
    id: string;
    name: string;
    slug: string;
    maxAgents: number;
    isActive?: boolean;
  };
  plan?: string;
  agentLimit?: number;
}
