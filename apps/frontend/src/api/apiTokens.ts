import api from './client';

export interface ApiToken {
  id: string;
  teamId: string | null;
  projectId: string | null;
  environmentId: string | null;
  name: string;
  tokenPrefix: string;
  permissions: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  isRevoked: boolean;
}

export interface CreatedApiToken {
  token: string; // raw token — shown only once at creation
  apiToken: ApiToken;
}

export const getTeamTokens = async (teamId: string): Promise<ApiToken[]> => {
  const { data } = await api.get<ApiToken[]>(`/teams/${teamId}/tokens`);
  return data;
};

export const createTeamToken = async (
  teamId: string,
  name: string,
  expiresAt?: string
): Promise<CreatedApiToken> => {
  const { data } = await api.post<CreatedApiToken>(`/teams/${teamId}/tokens`, {
    name,
    permissions: ['read'],
    expiresAt,
  });
  return data;
};

export const revokeTeamToken = async (teamId: string, tokenId: string): Promise<void> => {
  await api.delete(`/teams/${teamId}/tokens/${tokenId}`);
};
