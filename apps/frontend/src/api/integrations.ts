import api from './client';

export interface Integration {
  id: string;
  teamId: string;
  type: string;
  name: string;
  environmentId: string;
  config: { ownerSlug: string; contextName: string; contextId?: string };
  autoSync: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  createdAt: string;
  projectName?: string;
  environmentName?: string;
}

export interface IntegrationInput {
  name: string;
  environmentId: string;
  ownerSlug: string;
  contextName: string;
  token: string;
}

export const getIntegrations = async (teamId: string): Promise<Integration[]> => {
  const { data } = await api.get<Integration[]>(`/teams/${teamId}/integrations`);
  return data;
};

export const createIntegration = async (teamId: string, input: IntegrationInput): Promise<Integration> => {
  const { data } = await api.post<Integration>(`/teams/${teamId}/integrations`, input);
  return data;
};

export const deleteIntegration = async (teamId: string, integrationId: string): Promise<void> => {
  await api.delete(`/teams/${teamId}/integrations/${integrationId}`);
};

export const syncIntegration = async (
  teamId: string,
  integrationId: string
): Promise<{ synced: number; failed: string[] }> => {
  const { data } = await api.post(`/teams/${teamId}/integrations/${integrationId}/sync`);
  return data;
};
