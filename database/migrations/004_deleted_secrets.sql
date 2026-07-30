-- Archive of deleted secrets so their last value stays visible after deletion.

CREATE TABLE deleted_secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL,
    version INTEGER NOT NULL,
    deleted_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deleted_secrets_env ON deleted_secrets(environment_id);
