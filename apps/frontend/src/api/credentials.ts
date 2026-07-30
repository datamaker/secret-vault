import api from './client';

export interface Credential {
  id: string;
  teamId: string;
  name: string;
  url: string | null;
  username: string | null;
  password?: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialInput {
  name: string;
  url?: string | null;
  username?: string | null;
  password?: string;
  notes?: string | null;
}

export const getCredentials = async (teamId: string): Promise<Credential[]> => {
  const { data } = await api.get<Credential[]>(`/teams/${teamId}/credentials`);
  return data;
};

export const createCredential = async (teamId: string, input: CredentialInput): Promise<Credential> => {
  const { data } = await api.post<Credential>(`/teams/${teamId}/credentials`, input);
  return data;
};

export const updateCredential = async (
  teamId: string,
  credentialId: string,
  input: CredentialInput
): Promise<Credential> => {
  const { data } = await api.put<Credential>(`/teams/${teamId}/credentials/${credentialId}`, input);
  return data;
};

export const deleteCredential = async (teamId: string, credentialId: string): Promise<void> => {
  await api.delete(`/teams/${teamId}/credentials/${credentialId}`);
};
