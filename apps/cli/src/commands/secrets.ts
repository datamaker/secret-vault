import chalk from 'chalk';
import ora from 'ora';
import { getSecrets, getSecret, createSecret, updateSecret, deleteSecret } from '../api';
import { getEnvironment, getToken } from '../config';

function checkAuth(): void {
  if (!getToken()) {
    console.log(chalk.red('Not logged in. Please run `vault login` first.'));
    process.exit(1);
  }
}

function checkSetup(): string {
  const envId = getEnvironment();
  if (!envId) {
    console.log(chalk.red('Project not configured. Please run `vault setup` first.'));
    process.exit(1);
  }
  return envId;
}

export async function listSecretsCommand(options: { env?: string; json?: boolean }): Promise<void> {
  checkAuth();
  const envId = options.env || checkSetup();

  const spinner = ora('Loading secrets...').start();

  try {
    const secrets = await getSecrets(envId, false);
    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(secrets, null, 2));
      return;
    }

    if (secrets.length === 0) {
      console.log(chalk.yellow('No secrets found.'));
      return;
    }

    console.log(chalk.bold(`\nSecrets (${secrets.length}):\n`));

    const maxKeyLen = Math.max(...secrets.map((s) => s.key.length));
    for (const secret of secrets) {
      const key = secret.key.padEnd(maxKeyLen);
      const desc = secret.description ? chalk.gray(` - ${secret.description}`) : '';
      console.log(`  ${chalk.cyan(key)}${desc}`);
    }

    console.log(chalk.gray('\nUse `vault secrets get <KEY>` to view a secret value.'));
  } catch (error: unknown) {
    spinner.fail(chalk.red('Failed to load secrets'));
    const err = error as { response?: { data?: { message?: string } } };
    console.error(chalk.red(err.response?.data?.message || 'Unknown error'));
    process.exit(1);
  }
}

export async function getSecretCommand(key: string, options: { env?: string; plain?: boolean }): Promise<void> {
  checkAuth();
  const envId = options.env || checkSetup();

  const spinner = ora('Loading secret...').start();

  try {
    const secret = await getSecret(envId, key);
    spinner.stop();

    if (options.plain) {
      console.log(secret.value);
      return;
    }

    console.log(`\n${chalk.cyan(secret.key)}=${secret.value}`);
    if (secret.description) {
      console.log(chalk.gray(`# ${secret.description}`));
    }
  } catch (error: unknown) {
    spinner.fail(chalk.red('Failed to get secret'));
    const err = error as { response?: { status?: number; data?: { message?: string } } };
    if (err.response?.status === 404) {
      console.error(chalk.red(`Secret "${key}" not found.`));
    } else {
      console.error(chalk.red(err.response?.data?.message || 'Unknown error'));
    }
    process.exit(1);
  }
}

export async function setSecretCommand(
  key: string,
  value: string,
  options: { env?: string; description?: string }
): Promise<void> {
  checkAuth();
  const envId = options.env || checkSetup();

  const spinner = ora('Saving secret...').start();

  try {
    // Try to update first, if not found then create
    try {
      await updateSecret(envId, key, value);
      spinner.succeed(chalk.green(`Secret "${key}" updated.`));
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 404) {
        await createSecret(envId, key, value, options.description);
        spinner.succeed(chalk.green(`Secret "${key}" created.`));
      } else {
        throw error;
      }
    }
  } catch (error: unknown) {
    spinner.fail(chalk.red('Failed to save secret'));
    const err = error as { response?: { data?: { message?: string } } };
    console.error(chalk.red(err.response?.data?.message || 'Unknown error'));
    process.exit(1);
  }
}

export async function deleteSecretCommand(key: string, options: { env?: string }): Promise<void> {
  checkAuth();
  const envId = options.env || checkSetup();

  const spinner = ora('Deleting secret...').start();

  try {
    await deleteSecret(envId, key);
    spinner.succeed(chalk.green(`Secret "${key}" deleted.`));
  } catch (error: unknown) {
    spinner.fail(chalk.red('Failed to delete secret'));
    const err = error as { response?: { status?: number; data?: { message?: string } } };
    if (err.response?.status === 404) {
      console.error(chalk.red(`Secret "${key}" not found.`));
    } else {
      console.error(chalk.red(err.response?.data?.message || 'Unknown error'));
    }
    process.exit(1);
  }
}
