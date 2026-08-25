import Conf from 'conf';
import path from 'path';
import fs from 'fs';

interface Config {
  apiUrl: string;
  token?: string;
  refreshToken?: string;
  project?: string;
  environment?: string;
}

const config = new Conf<Config>({
  projectName: 'secret-vault',
  // Tokens live in this file — keep it out of other users' reach.
  configFileMode: 0o600,
  defaults: {
    apiUrl: 'http://localhost:3000',
  },
});

// configFileMode only applies on write; fix up files created by older CLI
// versions (conf's default left them world-readable).
try {
  if (fs.existsSync(config.path)) {
    fs.chmodSync(config.path, 0o600);
  }
} catch {
  // best effort — never block the CLI on a chmod failure
}

// Project-specific config file name
const PROJECT_CONFIG_FILE = '.vault.json';

interface ProjectConfig {
  project: string;
  environment: string;
}

export function getApiUrl(): string {
  return process.env.VAULT_API_URL || config.get('apiUrl');
}

export function setApiUrl(url: string): void {
  config.set('apiUrl', url);
}

export function getToken(): string | undefined {
  return process.env.VAULT_TOKEN || config.get('token');
}

export function setToken(token: string): void {
  config.set('token', token);
}

export function getRefreshToken(): string | undefined {
  return config.get('refreshToken');
}

export function setRefreshToken(token: string): void {
  config.set('refreshToken', token);
}

export function clearToken(): void {
  config.delete('token');
  config.delete('refreshToken');
}

export function getProjectConfig(): ProjectConfig | null {
  // Look for .vault.json in current directory and parent directories
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    const configPath = path.join(dir, PROJECT_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content) as ProjectConfig;
      } catch {
        return null;
      }
    }
    dir = path.dirname(dir);
  }
  return null;
}

export function saveProjectConfig(projectId: string, environment: string): void {
  const configPath = path.join(process.cwd(), PROJECT_CONFIG_FILE);
  const content: ProjectConfig = {
    project: projectId,
    environment,
  };
  fs.writeFileSync(configPath, JSON.stringify(content, null, 2));
}

export function getProject(): string | undefined {
  const projectConfig = getProjectConfig();
  return process.env.VAULT_PROJECT || projectConfig?.project || config.get('project');
}

export function getEnvironment(): string | undefined {
  const projectConfig = getProjectConfig();
  return process.env.VAULT_ENV || projectConfig?.environment || config.get('environment');
}

export default config;
