-- Secret Vault Database Schema
-- PostgreSQL 16+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team Roles
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Team Members
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, slug)
);

-- Environments
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, slug)
);

-- Secrets
CREATE TABLE secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(environment_id, key)
);

-- Secret History
CREATE TABLE secret_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
    encrypted_value TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL,
    version INTEGER NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Permissions
CREATE TYPE project_permission AS ENUM ('read', 'write', 'admin');

CREATE TABLE project_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission project_permission NOT NULL DEFAULT 'read',
    environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Tokens
CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    token_prefix VARCHAR(12) NOT NULL,
    permissions TEXT[] DEFAULT ARRAY['read'],
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT false
);

-- Audit Logs
CREATE TYPE audit_action AS ENUM (
    'secret.created', 'secret.updated', 'secret.deleted', 'secret.viewed',
    'project.created', 'project.updated', 'project.deleted',
    'team.created', 'team.member_added', 'team.member_removed',
    'user.login', 'user.logout', 'user.password_changed',
    'api_token.created', 'api_token.revoked'
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    project_id UUID REFERENCES projects(id),
    action audit_action NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_environments_project ON environments(project_id);
CREATE INDEX idx_secrets_environment ON secrets(environment_id);
CREATE INDEX idx_secrets_key ON secrets(key);
CREATE INDEX idx_secret_history_secret ON secret_history(secret_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_team ON audit_logs(team_id);
CREATE INDEX idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_api_tokens_project ON api_tokens(project_id);
