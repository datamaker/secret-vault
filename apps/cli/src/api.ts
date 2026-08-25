import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getApiUrl, getToken, getRefreshToken, setToken, setRefreshToken, clearToken } from './config';

let client: AxiosInstance | null = null;

/** Makes an error whose shape matches what command handlers print. */
function loginRequiredError(): Error {
  const err = new Error('Session expired. Run `vault login` to sign in again.');
  (err as unknown as { response: { data: { message: string } } }).response = {
    data: { message: 'Session expired. Run `vault login` to sign in again.' },
  };
  return err;
}

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

    // On 401, rotate the stored refresh token via /auth/cli/refresh and retry
    // the original request once. This keeps long-lived non-interactive (AI)
    // sessions alive without a human re-running `vault login`.
    client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const original = error.config as
          | (InternalAxiosRequestConfig & { _retried?: boolean })
          | undefined;
        const isAuthRoute = String(original?.url ?? '').startsWith('/auth/');

        if (
          error.response?.status !== 401 ||
          !original ||
          original._retried ||
          isAuthRoute ||
          process.env.VAULT_TOKEN // env-provided tokens are not ours to rotate
        ) {
          return Promise.reject(error);
        }

        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          return Promise.reject(loginRequiredError());
        }

        original._retried = true;
        try {
          const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
            `${getApiUrl()}/api/v1/auth/cli/refresh`,
            { refreshToken }
          );
          setToken(data.accessToken);
          setRefreshToken(data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return client!.request(original);
        } catch {
          clearToken();
          return Promise.reject(loginRequiredError());
        }
      }
    );
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

export interface OidcStatus {
  enabled: boolean;
  issuer?: string;
  cliClientId?: string;
}

export async function getOidcStatus(): Promise<OidcStatus> {
  const { data } = await getClient().get<OidcStatus>('/auth/oidc/status');
  return data;
}

export interface SsoLoginResponse extends LoginResponse {
  refreshToken: string;
}

export async function exchangeIdToken(idToken: string): Promise<SsoLoginResponse> {
  const { data } = await getClient().post<SsoLoginResponse>('/auth/oidc/exchange', { idToken });
  return data;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

export async function getMe(): Promise<Me> {
  const { data } = await getClient().get<{ user: Me }>('/auth/me');
  return data.user;
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
