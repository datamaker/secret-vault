import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { login } from '../api';
import { setToken, setApiUrl, getApiUrl } from '../config';

export async function loginCommand(options: { email?: string; apiUrl?: string }): Promise<void> {
  console.log(chalk.bold('\nSecret Vault Login\n'));

  // Set API URL if provided
  if (options.apiUrl) {
    setApiUrl(options.apiUrl);
    console.log(chalk.gray(`API URL: ${options.apiUrl}`));
  } else {
    console.log(chalk.gray(`API URL: ${getApiUrl()}`));
  }

  // Get credentials
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      default: options.email,
      validate: (input) => input.includes('@') || 'Please enter a valid email',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      validate: (input) => input.length > 0 || 'Password is required',
    },
  ]);

  const spinner = ora('Authenticating...').start();

  try {
    const response = await login(answers.email, answers.password);
    setToken(response.accessToken);

    spinner.succeed(chalk.green('Login successful!'));
    console.log(chalk.gray(`\nLogged in as ${response.user.name} (${response.user.email})`));
    console.log(chalk.gray('\nRun `vault setup` to configure your project.'));
  } catch (error: unknown) {
    spinner.fail(chalk.red('Login failed'));
    const err = error as { response?: { data?: { message?: string } } };
    console.error(chalk.red(err.response?.data?.message || 'Invalid credentials'));
    process.exit(1);
  }
}
