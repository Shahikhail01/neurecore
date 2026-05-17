/**
 * useAgents Hook
 * Manages agents state and API calls
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import agentService, {
  Agent,
  CreateAgentRequest,
  UpdateAgentRequest,
} from "@/services/agentService";
import { useAuth } from "./useAuth";

export function useAgents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantId = user?.tenantId;

  const fetchAgents = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await agentService.getAgents(tenantId);
      setAgents(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const createAgent = useCallback(
    async (request: CreateAgentRequest) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        const newAgent = await agentService.createAgent(tenantId, request);
        setAgents((prev) => [newAgent, ...prev]);
        return newAgent;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  const updateAgent = useCallback(
    async (agentId: string, request: UpdateAgentRequest) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        const updated = await agentService.updateAgent(
          tenantId,
          agentId,
          request,
        );
        setAgents((prev) => prev.map((a) => (a.id === agentId ? updated : a)));
        return updated;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  const deleteAgent = useCallback(
    async (agentId: string) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        await agentService.deleteAgent(tenantId, agentId);
        setAgents((prev) => prev.filter((a) => a.id !== agentId));
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    loading,
    error,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
  };
}
