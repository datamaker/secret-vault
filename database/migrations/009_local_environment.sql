-- 모든 프로젝트에 Local 환경 추가 (기본 환경 목록에도 추가됨)
-- 기존 환경은 order_index를 한 칸씩 밀어 Local이 맨 앞에 오게 한다.

UPDATE environments SET order_index = order_index + 1;

INSERT INTO environments (project_id, name, slug, color, order_index)
SELECT p.id, 'Local', 'local', '#64748b', 0
FROM projects p
WHERE NOT EXISTS (
    SELECT 1 FROM environments e WHERE e.project_id = p.id AND e.slug = 'local'
);
