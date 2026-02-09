import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { getSecrets } from '../api';
import { getEnvironment, getToken } from '../config';

export async function runCommand(command: string[], options: { env?: string }): Promise<void> {
  if (!getToken()) {
    console.log(chalk.red('Not logged in. Please run `vault login` first.'));
    process.exit(1);
  }

  const envId = options.env || getEnvironment();
  if (!envId) {
    console.log(chalk.red('Project not configured. Please run `vault setup` first.'));
    process.exit(1);
  }

  if (command.length === 0) {
    console.log(chalk.red('No command specified. Usage: vault run -- <command>'));
    process.exit(1);
  }

  const spinner = ora('Loading secrets...').start();

  try {
    const secrets = await getSecrets(envId, true);
    spinner.stop();

    // Build environment variables
    const secretsEnv: Record<string, string> = {};
    for (const secret of secrets) {
      if (secret.value !== undefined) {
        secretsEnv[secret.key] = secret.value;
      }
    }

    console.log(chalk.gray(`Injecting ${secrets.length} secrets into environment...\n`));

    // Run the command with secrets injected
    const [cmd, ...args] = command;
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...secretsEnv,
      },
      shell: true,
    });

    child.on('error', (error) => {
      console.error(chalk.red(`Failed to run command: ${error.message}`));
      process.exit(1);
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  } catch (error: unknown) {
    spinner.fail(chalk.red('Failed to load secrets'));
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    console.error(chalk.red(err.response?.data?.message || err.message || 'Unknown error'));
    process.exit(1);
  }
}
