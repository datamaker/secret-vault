import api from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  isAdmin: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export const register = async (email: string, password: string, name: string): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, password, name });
  return data;
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const getMe = async (): Promise<{ user: User }> => {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data;
};
