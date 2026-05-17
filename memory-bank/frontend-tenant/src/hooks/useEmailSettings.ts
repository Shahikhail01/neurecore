/**
 * Email Settings Hook
 *
 * Single Responsibility: Only handles Email settings data fetching and state management
 */

import { useState, useEffect, useCallback } from "react";
import { getEmailSettingsService } from "@/services/settings";
import type {
  EmailConfig,
  EmailTemplate,
  EmailLog,
  PaginatedAuditLogs,
} from "@/types/settings.types";

interface UseEmailSettingsState {
  configs: EmailConfig[];
  templates: EmailTemplate[];
  loading: boolean;
  error: string | null;
}

interface UseEmailSettingsActions {
  refresh: () => Promise<void>;
  // Config actions
  createConfig: (data: Partial<EmailConfig>) => Promise<EmailConfig>;
  updateConfig: (
    id: string,
    data: Partial<EmailConfig>,
  ) => Promise<EmailConfig>;
  deleteConfig: (id: string) => Promise<void>;
  toggleConfig: (id: string, enabled: boolean) => Promise<void>;
  setDefaultConfig: (id: string) => Promise<void>;
  testConfig: (
    id: string,
    testEmail: string,
  ) => Promise<{ success: boolean; error?: string }>;
  // Template actions
  createTemplate: (data: Partial<EmailTemplate>) => Promise<EmailTemplate>;
  updateTemplate: (
    id: string,
    data: Partial<EmailTemplate>,
  ) => Promise<EmailTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
  toggleTemplate: (id: string, active: boolean) => Promise<void>;
  // Log actions
  getLogs: (params?: {
    page?: number;
    limit?: number;
    status?: EmailLog["status"];
    type?: EmailTemplate["type"];
    search?: string;
  }) => Promise<PaginatedAuditLogs>;
  resendEmail: (logId: string) => Promise<EmailLog>;
}

export function useEmailSettings(): UseEmailSettingsState &
  UseEmailSettingsActions {
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const service = getEmailSettingsService();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configsData, templatesData] = await Promise.all([
        service.getConfigs(),
        service.getTemplates(),
      ]);
      setConfigs(configsData);
      setTemplates(templatesData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load email settings",
      );
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Config actions
  const createConfig = useCallback(
    async (data: Partial<EmailConfig>): Promise<EmailConfig> => {
      const config = await service.createConfig(data);
      void refresh();
      return config;
    },
    [service, refresh],
  );

  const updateConfig = useCallback(
    async (id: string, data: Partial<EmailConfig>): Promise<EmailConfig> => {
      const config = await service.updateConfig(id, data);
      void refresh();
      return config;
    },
    [service, refresh],
  );

  const deleteConfig = useCallback(
    async (id: string): Promise<void> => {
      await service.deleteConfig(id);
      void refresh();
    },
    [service, refresh],
  );

  const toggleConfig = useCallback(
    async (id: string, enabled: boolean): Promise<void> => {
      await service.toggleConfig(id, enabled);
      void refresh();
    },
    [service, refresh],
  );

  const setDefaultConfig = useCallback(
    async (id: string): Promise<void> => {
      await service.setDefaultConfig(id);
      void refresh();
    },
    [service, refresh],
  );

  const testConfig = useCallback(
    async (id: string, testEmail: string) => {
      return service.testConfig(id, testEmail);
    },
    [service],
  );

  // Template actions
  const createTemplate = useCallback(
    async (data: Partial<EmailTemplate>): Promise<EmailTemplate> => {
      const template = await service.createTemplate(data);
      void refresh();
      return template;
    },
    [service, refresh],
  );

  const updateTemplate = useCallback(
    async (
      id: string,
      data: Partial<EmailTemplate>,
    ): Promise<EmailTemplate> => {
      const template = await service.updateTemplate(id, data);
      void refresh();
      return template;
    },
    [service, refresh],
  );

  const deleteTemplate = useCallback(
    async (id: string): Promise<void> => {
      await service.deleteTemplate(id);
      void refresh();
    },
    [service, refresh],
  );

  const toggleTemplate = useCallback(
    async (id: string, active: boolean): Promise<void> => {
      await service.toggleTemplate(id, active);
      void refresh();
    },
    [service, refresh],
  );

  // Log actions
  const getLogs = useCallback(
    async (params?: {
      page?: number;
      limit?: number;
      status?: EmailLog["status"];
      type?: EmailTemplate["type"];
      search?: string;
    }) => {
      return service.getLogs(params);
    },
    [service],
  );

  const resendEmail = useCallback(
    async (logId: string): Promise<EmailLog> => {
      return service.resendEmail(logId);
    },
    [service],
  );

  return {
    configs,
    templates,
    loading,
    error,
    refresh,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleConfig,
    setDefaultConfig,
    testConfig,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleTemplate,
    getLogs,
    resendEmail,
  };
}
