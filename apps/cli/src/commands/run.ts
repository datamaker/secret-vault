import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { getSecrets } from '../api';
import { getEnvironment, getToken } from '../config';

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SHELL_METACHARS = /[|&;<>()$`\\"'*?[\]]/;

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

    // `vault run -- FOO=bar cmd` 형태의 선행 할당은 쉘 없이도 동작하도록 직접 처리한다
    const inlineEnv: Record<string, string> = {};
    const rest = [...command];
    while (rest.length > 0 && ASSIGNMENT.test(rest[0])) {
      const [key, ...valueParts] = rest.shift()!.split('=');
      inlineEnv[key] = valueParts.join('=');
    }

    if (rest.length === 0) {
      console.error(chalk.red('No command specified after environment assignments.'));
      process.exit(1);
    }

    console.log(chalk.gray(`Injecting ${secrets.length} secrets into environment...\n`));

    // 인자가 하나이고 쉘 문법(파이프, && 등)을 담고 있으면 쉘로, 아니면 argv를 그대로 보존해 실행한다.
    // 쉘로 넘길 때 인자를 이어붙이면 공백이 포함된 인자가 쪼개지므로 그 경우에만 shell을 쓴다.
    const useShell = rest.length === 1 && SHELL_METACHARS.test(rest[0]);
    const [cmd, ...args] = rest;

    const child = spawn(useShell ? rest[0] : cmd, useShell ? [] : args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...secretsEnv,
        ...inlineEnv,
      },
      shell: useShell,
    });

    child.on('error', (error) => {
      console.error(chalk.red(`Failed to run command: ${error.message}`));
      process.exit(1);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 0);
    });

    // Ctrl+C 등을 자식에게 전달
    for (const sig of ['SIGINT', 'SIGTERM'] as const) {
      process.on(sig, () => child.kill(sig));
    }
  } catch (error: unknown) {
    spinner.fail(chalk.red('Failed to load secrets'));
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    console.error(chalk.red(err.response?.data?.message || err.message || 'Unknown error'));
    process.exit(1);
  }
}
