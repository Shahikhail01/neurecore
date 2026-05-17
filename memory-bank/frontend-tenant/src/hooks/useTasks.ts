/**
 * useTasks Hook
 * Manages tasks state and API calls
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import taskService, {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "@/services/taskService";
import { useAuth } from "./useAuth";

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantId = user?.tenantId;

  const fetchTasks = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await taskService.getTasks(tenantId);
      setTasks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const createTask = useCallback(
    async (request: CreateTaskRequest) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        const newTask = await taskService.createTask(tenantId, request);
        setTasks((prev) => [newTask, ...prev]);
        return newTask;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  const updateTask = useCallback(
    async (taskId: string, request: UpdateTaskRequest) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        const updated = await taskService.updateTask(tenantId, taskId, request);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        return updated;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        await taskService.deleteTask(tenantId, taskId);
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, status: string) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        const updated = await taskService.updateTaskStatus(
          tenantId,
          taskId,
          status,
        );
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        return updated;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
  };
}
