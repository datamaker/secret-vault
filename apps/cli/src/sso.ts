import axios from 'axios';
import { spawn } from 'child_process';

/**
 * OAuth 2.0 Device Authorization Grant (RFC 8628) against the vault's IdP.
 * The CLI is a public client: no secret, PKCE-free device flow, and the
 * resulting id_token is exchanged at the vault backend for vault tokens.
 */

interface DiscoveryDoc {
  device_authorization_endpoint?: string;
  token_endpoint: string;
}

export interface DeviceAuthorization {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

const SCOPE = 'openid email profile';

export async function discover(issuer: string): Promise<DiscoveryDoc> {
  const { data } = await axios.get<DiscoveryDoc>(
    `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`
  );
  if (!data.device_authorization_endpoint) {
    throw new Error('IdP does not support the device flow (no device_authorization_endpoint)');
  }
  return data;
}

export async function startDeviceAuthorization(
  discovery: DiscoveryDoc,
  clientId: string
): Promise<DeviceAuthorization> {
  const { data } = await axios.post<DeviceAuthorization>(
    discovery.device_authorization_endpoint!,
    new URLSearchParams({ client_id: clientId, scope: SCOPE })
  );
  return data;
}

/**
 * Polls the token endpoint until the user approves (or the flow fails).
 * Resolves with the id_token.
 */
export async function pollForIdToken(
  discovery: DiscoveryDoc,
  clientId: string,
  auth: DeviceAuthorization
): Promise<string> {
  let intervalMs = (auth.interval ?? 5) * 1000;
  const deadline = Date.now() + auth.expires_in * 1000;

  for (;;) {
    if (Date.now() > deadline) {
      throw new Error('Device login timed out. Run `vault login` again.');
    }
    await sleep(intervalMs);

    const res = await axios.post<{ id_token?: string; error?: string; error_description?: string }>(
      discovery.token_endpoint,
      new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: auth.device_code,
        client_id: clientId,
      }),
      { validateStatus: () => true }
    );

    if (res.status === 200) {
      if (!res.data.id_token) throw new Error('IdP response missing id_token');
      return res.data.id_token;
    }

    switch (res.data.error) {
      case 'authorization_pending':
        continue;
      case 'slow_down':
        intervalMs += 5000;
        continue;
      case 'expired_token':
        throw new Error('Device code expired before approval. Run `vault login` again.');
      case 'access_denied':
        throw new Error('Login was denied in the browser.');
      default:
        throw new Error(
          res.data.error_description || res.data.error || `Device login failed (HTTP ${res.status})`
        );
    }
  }
}

/** Best-effort browser open; failures are silently ignored (headless hosts). */
export function tryOpenBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(cmd as string, args as string[], { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // ignore — the user can open the printed URL manually
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
