-- 외부 시스템 단방향 싱크 (Doppler integrations 스타일)
-- 지금은 CircleCI context만 지원. vault 환경 1개 → CircleCI context 1개로 시크릿을 밀어넣는다.

CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL DEFAULT 'circleci',
    name VARCHAR(100) NOT NULL,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    -- CircleCI: { ownerSlug: "gh/datamaker", contextName: "cacheby-prod", contextId: "..." }
    config JSONB NOT NULL,
    -- API 토큰은 시크릿과 동일한 방식으로 암호화 저장
    encrypted_token TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL,
    auto_sync BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20),
    last_sync_message TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_integrations_team ON integrations(team_id);
CREATE INDEX idx_integrations_env ON integrations(environment_id);

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'integration.created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'integration.deleted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'integration.synced';
