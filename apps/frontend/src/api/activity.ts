import api from './client';

export interface ActivityEntry {
  id: string;
  action: string;
  userName: string | null;
  userEmail: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export const getTeamActivity = async (teamId: string, limit = 50, offset = 0): Promise<ActivityEntry[]> => {
  const { data } = await api.get<ActivityEntry[]>(`/teams/${teamId}/activity`, {
    params: { limit, offset },
  });
  return data;
};
