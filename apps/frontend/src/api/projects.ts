import api from './client';

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  color: string;
  orderIndex: number;
}

export const getProjects = async (teamId: string): Promise<Project[]> => {
  const { data } = await api.get<Project[]>(`/projects/teams/${teamId}/projects`);
  return data;
};

export const createProject = async (teamId: string, name: string, description?: string): Promise<Project> => {
  const { data } = await api.post<Project>(`/projects/teams/${teamId}/projects`, { name, description });
  return data;
};

export const getProject = async (projectId: string): Promise<Project> => {
  const { data } = await api.get<Project>(`/projects/${projectId}`);
  return data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await api.delete(`/projects/${projectId}`);
};

export const getEnvironments = async (projectId: string): Promise<Environment[]> => {
  const { data } = await api.get<Environment[]>(`/projects/${projectId}/environments`);
  return data;
};

export const createEnvironment = async (projectId: string, name: string, color?: string): Promise<Environment> => {
  const { data } = await api.post<Environment>(`/projects/${projectId}/environments`, { name, color });
  return data;
};
