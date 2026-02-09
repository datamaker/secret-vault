#!/usr/bin/env node

import { Command } from 'commander';
import { loginCommand } from './commands/login';
import { setupCommand } from './commands/setup';
import { runCommand } from './commands/run';
import {
  listSecretsCommand,
  getSecretCommand,
  setSecretCommand,
  deleteSecretCommand,
} from './commands/secrets';
import { exportCommand } from './commands/export';

const program = new Command();

program
  .name('vault')
  .description('Secret Vault CLI - Securely manage your secrets')
  .version('1.0.0');

// Login command
program
  .command('login')
  .description('Login to Secret Vault')
  .option('-e, --email <email>', 'Email address')
  .option('--api-url <url>', 'API URL (default: http://localhost:3000)')
  .action(loginCommand);

// Logout command
program
  .command('logout')
  .description('Logout from Secret Vault')
  .action(() => {
    const { clearToken } = require('./config');
    clearToken();
    console.log('Logged out successfully.');
  });

// Setup command
program
  .command('setup')
  .description('Configure project and environment')
  .action(setupCommand);

// Run command
program
  .command('run')
  .description('Run a command with secrets injected as environment variables')
  .option('--env <envId>', 'Environment ID (overrides .vault.json)')
  .argument('<command...>', 'Command to run')
  .allowUnknownOption()
  .action((command, options) => runCommand(command, options));

// Export command - for injecting into current shell
program
  .command('export')
  .description('Export secrets for shell injection (use with eval)')
  .option('--env <envId>', 'Environment ID')
  .option('-f, --format <format>', 'Output format: shell, env, json (default: shell)')
  .action(exportCommand);

// Secrets command group
const secrets = program
  .command('secrets')
  .description('Manage secrets');

secrets
  .command('list')
  .alias('ls')
  .description('List all secrets')
  .option('--env <envId>', 'Environment ID')
  .option('--json', 'Output as JSON')
  .action(listSecretsCommand);

secrets
  .command('get <key>')
  .description('Get a secret value')
  .option('--env <envId>', 'Environment ID')
  .option('--plain', 'Output only the value (for scripts)')
  .action(getSecretCommand);

secrets
  .command('set <key> <value>')
  .description('Set a secret value')
  .option('--env <envId>', 'Environment ID')
  .option('-d, --description <description>', 'Secret description')
  .action(setSecretCommand);

secrets
  .command('delete <key>')
  .alias('rm')
  .description('Delete a secret')
  .option('--env <envId>', 'Environment ID')
  .action(deleteSecretCommand);

// Default action for 'vault secrets' (alias for list)
secrets.action(() => {
  listSecretsCommand({});
});

program.parse();
