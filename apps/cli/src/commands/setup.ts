import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { getTeams, getProjects, getEnvironments } from '../api';
import { saveProjectConfig, getToken } from '../config';

export async function setupCommand(): Promise<void> {
  console.log(chalk.bold('\nSecret Vault Setup\n'));

  if (!getToken()) {
    console.log(chalk.red('Not logged in. Please run `vault login` first.'));
    process.exit(1);
  }

  const spinner = ora('Loading teams...').start();

  try {
    // Get teams
    const teams = await getTeams();
    spinner.stop();

    if (teams.length === 0) {
      console.log(chalk.yellow('No teams found. Create a team in the web UI first.'));
      process.exit(1);
    }

    // Select team
    const teamAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'team',
        message: 'Select a team:',
        choices: teams.map((t) => ({ name: t.name, value: t.id })),
      },
    ]);

    // Get projects
    spinner.start('Loading projects...');
    const projects = await getProjects(teamAnswer.team);
    spinner.stop();

    if (projects.length === 0) {
      console.log(chalk.yellow('No projects found in this team. Create a project first.'));
      process.exit(1);
    }

    // Select project
    const projectAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'project',
        message: 'Select a project:',
        choices: projects.map((p) => ({ name: p.name, value: p.id })),
      },
    ]);

    // Get environments
    spinner.start('Loading environments...');
    const environments = await getEnvironments(projectAnswer.project);
    spinner.stop();

    // Select environment
    const envAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Select default environment:',
        choices: environments.map((e) => ({ name: e.name, value: e.id })),
      },
    ]);

    // Save config
    saveProjectConfig(projectAnswer.project, envAnswer.environment);

    console.log(chalk.green('\nSetup complete!'));
    console.log(chalk.gray('Configuration saved to .vault.json'));
    console.log(chalk.gray('\nYou can now use:'));
    console.log(chalk.cyan('  vault run -- <command>  ') + chalk.gray('Run command with secrets'));
    console.log(chalk.cyan('  vault secrets           ') + chalk.gray('List all secrets'));
    console.log(chalk.cyan('  vault secrets get KEY   ') + chalk.gray('Get a specific secret'));
  } catch (error: unknown) {
    spinner.fail(chalk.red('Setup failed'));
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    console.error(chalk.red(err.response?.data?.message || err.message || 'Unknown error'));
    process.exit(1);
  }
}
