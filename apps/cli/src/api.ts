import axios, { AxiosInstance } from 'axios';
import { getApiUrl, getToken } from './config';

let client: AxiosInstance | null = null;

export function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: `${getApiUrl()}/api/v1`,
    });

    client.interceptors.request.use((config) => {
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }
  return client;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  accessToken: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
}

export interface Secret {
  id: string;
  key: string;
  value?: string;
  description?: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await getClient().post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function getTeams(): Promise<Team[]> {
  const { data } = await getClient().get<Team[]>('/teams');
  return data;
}

export async function getProjects(teamId: string): Promise<Project[]> {
  const { data } = await getClient().get<Project[]>(`/projects/teams/${teamId}/projects`);
  return data;
}

export async function getEnvironments(projectId: string): Promise<Environment[]> {
  const { data } = await getClient().get<Environment[]>(`/projects/${projectId}/environments`);
  return data;
}

export async function getSecrets(envId: string, includeValues = true): Promise<Secret[]> {
  const { data } = await getClient().get<Secret[]>(`/environments/${envId}/secrets`, {
    params: { values: includeValues },
  });
  return data;
}

export async function getSecret(envId: string, key: string): Promise<Secret> {
  const { data } = await getClient().get<Secret>(`/environments/${envId}/secrets/${key}`);
  return data;
}

export async function createSecret(
  envId: string,
  key: string,
  value: string,
  description?: string
): Promise<Secret> {
  const { data } = await getClient().post<Secret>(`/environments/${envId}/secrets`, {
    key,
    value,
    description,
  });
  return data;
}

export async function updateSecret(
  envId: string,
  key: string,
  value: string
): Promise<Secret> {
  const { data } = await getClient().put<Secret>(`/environments/${envId}/secrets/${key}`, {
    value,
  });
  return data;
}

export async function deleteSecret(envId: string, key: string): Promise<void> {
  await getClient().delete(`/environments/${envId}/secrets/${key}`);
}
