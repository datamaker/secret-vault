import api from './client';

export interface Secret {
  id: string;
  environmentId: string;
  key: string;
  value?: string;
  description?: string;
  isSensitive: boolean;
  version: number;
  updatedAt: string;
}

export const getSecrets = async (envId: string, includeValues = false): Promise<Secret[]> => {
  const { data } = await api.get<Secret[]>(`/environments/${envId}/secrets`, {
    params: { values: includeValues },
  });
  return data;
};

export const getSecret = async (envId: string, key: string): Promise<Secret> => {
  const { data } = await api.get<Secret>(`/environments/${envId}/secrets/${key}`);
  return data;
};

export const createSecret = async (
  envId: string,
  key: string,
  value: string,
  description?: string,
  isSensitive = true
): Promise<Secret> => {
  const { data } = await api.post<Secret>(`/environments/${envId}/secrets`, {
    key,
    value,
    description,
    isSensitive,
  });
  return data;
};

export const updateSecret = async (
  envId: string,
  key: string,
  value?: string,
  description?: string,
  isSensitive?: boolean
): Promise<Secret> => {
  const { data } = await api.put<Secret>(`/environments/${envId}/secrets/${key}`, {
    value,
    description,
    isSensitive,
  });
  return data;
};

export const deleteSecret = async (envId: string, key: string): Promise<void> => {
  await api.delete(`/environments/${envId}/secrets/${key}`);
};

export const exportSecrets = async (envId: string, format: 'env' | 'json' = 'env'): Promise<string> => {
  const { data } = await api.get(`/environments/${envId}/secrets/export`, {
    params: { format },
    responseType: format === 'env' ? 'text' : 'json',
  });
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
};

export const importSecrets = async (envId: string, content: string): Promise<{ imported: number }> => {
  const { data } = await api.post<{ imported: number }>(`/environments/${envId}/secrets/import`, { content });
  return data;
};
