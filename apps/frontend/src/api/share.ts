import api from './client';

export const createShareLink = async (
  ciphertext: string,
  iv: string,
  expiresInHours: number,
  maxViews: number | null
): Promise<{ id: string; expiresAt: string }> => {
  const { data } = await api.post('/share', { ciphertext, iv, expiresInHours, maxViews });
  return data;
};

export const revealShareLink = async (
  id: string
): Promise<{ ciphertext: string; iv: string; remainingViews: number | null }> => {
  const { data } = await api.post(`/share/${id}/reveal`);
  return data;
};
