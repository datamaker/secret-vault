import chalk from 'chalk';
import ora from 'ora';
import { getSecrets } from '../api';
import { getEnvironment, getToken, getApiUrl } from '../config';

export async function exportCommand(options: {
  env?: string;
  format?: 'shell' | 'env' | 'json';
}): Promise<void> {
  if (!getToken()) {
    console.error('# Error: Not logged in. Run: vault login');
    process.exit(1);
  }

  const envId = options.env || getEnvironment();
  if (!envId) {
    console.error('# Error: Not configured. Run: vault setup');
    process.exit(1);
  }

  const format = options.format || 'shell';

  try {
    const secrets = await getSecrets(envId, true);

    if (secrets.length === 0) {
      if (format === 'shell') {
        console.log('# No secrets found');
      }
      return;
    }

    switch (format) {
      case 'shell':
        // Output format for eval $(vault export)
        for (const secret of secrets) {
          if (secret.value !== undefined) {
            // Escape single quotes in value
            const escapedValue = secret.value.replace(/'/g, "'\\''");
            console.log(`export ${secret.key}='${escapedValue}'`);
          }
        }
        break;

      case 'env':
        // .env file format
        for (const secret of secrets) {
          if (secret.value !== undefined) {
            const needsQuotes = /[\s"'`$\\]/.test(secret.value);
            if (needsQuotes) {
              const escapedValue = secret.value.replace(/"/g, '\\"');
              console.log(`${secret.key}="${escapedValue}"`);
            } else {
              console.log(`${secret.key}=${secret.value}`);
            }
          }
        }
        break;

      case 'json':
        const obj: Record<string, string> = {};
        for (const secret of secrets) {
          if (secret.value !== undefined) {
            obj[secret.key] = secret.value;
          }
        }
        console.log(JSON.stringify(obj, null, 2));
        break;
    }
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    console.error(`# Error: ${err.response?.data?.message || err.message || 'Unknown error'}`);
    process.exit(1);
  }
}

