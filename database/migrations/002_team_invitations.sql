-- Team Invitations (for inviting users who haven't registered yet)
CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role team_role NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
    UNIQUE(team_id, email)
);

CREATE INDEX idx_team_invitations_email ON team_invitations(email);
