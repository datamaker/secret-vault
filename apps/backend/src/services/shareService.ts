import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const MAX_EXPIRY_HOURS = 24 * 7; // 최대 7일
const MAX_CIPHERTEXT_LENGTH = 100_000;

export const createShare = async (
  ciphertext: string,
  iv: string,
  expiresInHours: number,
  maxViews: number | null,
  userId: string
): Promise<{ id: string; expiresAt: Date }> => {
  if (!ciphertext || !iv) {
    throw new AppError('ciphertext and iv are required', 400);
  }
  if (ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
    throw new AppError('Content is too large', 400);
  }

  const hours = Math.min(Math.max(expiresInHours || 24, 1), MAX_EXPIRY_HOURS);
  const views = maxViews && maxViews > 0 ? Math.min(maxViews, 1000) : null;

  const result = await query(
    `INSERT INTO share_links (ciphertext, iv, max_views, expires_at, created_by)
     VALUES ($1, $2, $3, NOW() + ($4 || ' hours')::interval, $5)
     RETURNING id, expires_at`,
    [ciphertext, iv, views, String(hours), userId]
  );

  return { id: result.rows[0].id, expiresAt: result.rows[0].expires_at };
};

export const revealShare = async (
  id: string
): Promise<{ ciphertext: string; iv: string; remainingViews: number | null }> => {
  // 만료/조회수 초과가 아닌 경우에만 원자적으로 조회수를 올리며 가져온다
  const result = await query(
    `UPDATE share_links
     SET view_count = view_count + 1
     WHERE id = $1
       AND expires_at > NOW()
       AND (max_views IS NULL OR view_count < max_views)
     RETURNING ciphertext, iv, view_count, max_views`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError('This link has expired or reached its view limit', 410);
  }

  const row = result.rows[0];

  // 마지막 조회였으면 암호문을 즉시 파기
  if (row.max_views !== null && row.view_count >= row.max_views) {
    await query('DELETE FROM share_links WHERE id = $1', [id]);
  }

  return {
    ciphertext: row.ciphertext,
    iv: row.iv,
    remainingViews: row.max_views === null ? null : Math.max(0, row.max_views - row.view_count),
  };
};

// 만료된 링크 정리 (reveal 시도 시 기회적으로 호출)
export const purgeExpired = async (): Promise<void> => {
  try {
    await query('DELETE FROM share_links WHERE expires_at <= NOW()');
  } catch (error) {
    console.error('Failed to purge expired share links:', error);
  }
};
