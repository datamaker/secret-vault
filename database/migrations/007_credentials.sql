-- 1Password 스타일 공용 크리덴셜 (팀 스코프의 id/password/url 저장소)

CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    url TEXT,
    username VARCHAR(255),
    encrypted_password TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_credentials_team ON credentials(team_id);

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'credential.created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'credential.updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'credential.deleted';
