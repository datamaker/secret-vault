import chalk from 'chalk';
import { getMe } from '../api';
import { getApiUrl, getToken, getRefreshToken } from '../config';

interface JwtPayload {
  email?: string;
  exp?: number;
  [key: string]: unknown;
}

/** Decodes a JWT payload locally; returns null for opaque tokens (e.g. sv_ API tokens). */
function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as JwtPayload;
  } catch {
    return null;
  }
}

export async function statusCommand(): Promise<void> {
  console.log(chalk.bold('\nSecret Vault Status\n'));
  console.log(`API URL:       ${getApiUrl()}`);

  const token = getToken();
  if (!token) {
    console.log(`Logged in:     ${chalk.yellow('no')} — run \`vault login\``);
    return;
  }

  const source = process.env.VAULT_TOKEN ? 'VAULT_TOKEN env' : 'stored login';
  console.log(`Token source:  ${source}`);
  console.log(`Auto-refresh:  ${getRefreshToken() && !process.env.VAULT_TOKEN ? 'enabled (SSO refresh token stored)' : 'off'}`);

  const payload = decodeJwt(token);
  if (payload?.exp) {
    const expires = new Date(payload.exp * 1000);
    const expired = expires.getTime() < Date.now();
    console.log(
      `Token expires: ${expires.toLocaleString()}${expired ? chalk.red(' (expired)') : ''}`
    );
  }

  // Prefer the server's answer (verifies the token actually works); fall back
  // to the locally decoded claims when the server is unreachable.
  try {
    const me = await getMe();
    console.log(`Logged in as:  ${chalk.green(`${me.name} (${me.email})`)}`);
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    if (payload?.email) {
      console.log(`Logged in as:  ${payload.email} ${chalk.gray('(from token; server not verified)')}`);
    }
    console.log(
      chalk.yellow(`Server check:  failed — ${err.response?.data?.message || err.message || 'unknown error'}`)
    );
  }
}
