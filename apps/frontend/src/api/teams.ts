import api from './client';

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const getTeams = async (): Promise<Team[]> => {
  const { data } = await api.get<Team[]>('/teams');
  return data;
};

export const createTeam = async (name: string, description?: string): Promise<Team> => {
  const { data } = await api.post<Team>('/teams', { name, description });
  return data;
};

export const getTeam = async (teamId: string): Promise<Team> => {
  const { data } = await api.get<Team>(`/teams/${teamId}`);
  return data;
};

export const deleteTeam = async (teamId: string): Promise<void> => {
  await api.delete(`/teams/${teamId}`);
};

export const getTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
  const { data } = await api.get<TeamMember[]>(`/teams/${teamId}/members`);
  return data;
};

export const addTeamMember = async (teamId: string, email: string, role: string): Promise<TeamMember> => {
  const { data } = await api.post<TeamMember>(`/teams/${teamId}/members`, { email, role });
  return data;
};

export const removeTeamMember = async (teamId: string, userId: string): Promise<void> => {
  await api.delete(`/teams/${teamId}/members/${userId}`);
};

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: string;
  expiresAt: string;
}

export const getTeamInvitations = async (teamId: string): Promise<TeamInvitation[]> => {
  const { data } = await api.get<TeamInvitation[]>(`/teams/${teamId}/invitations`);
  return data;
};

export const cancelTeamInvitation = async (teamId: string, invitationId: string): Promise<void> => {
  await api.delete(`/teams/${teamId}/invitations/${invitationId}`);
};
