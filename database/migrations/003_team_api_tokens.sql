-- Team-scoped API tokens
-- A token is scoped to exactly one of: team (all projects) or project (optionally one environment).

ALTER TABLE api_tokens ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE api_tokens ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE api_tokens ADD CONSTRAINT api_tokens_scope_check
    CHECK (team_id IS NOT NULL OR project_id IS NOT NULL);

CREATE INDEX idx_api_tokens_team ON api_tokens(team_id);
CREATE INDEX idx_api_tokens_prefix ON api_tokens(token_prefix);
