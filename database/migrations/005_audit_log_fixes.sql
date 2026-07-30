-- Audit log fixes for the activity feed:
-- 1) allow deleting projects/teams/users that have audit logs
-- 2) new action value for member role changes

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'team.member_role_changed';

ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_project_id_fkey;
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_team_id_fkey;
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_user_id_fkey;
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
