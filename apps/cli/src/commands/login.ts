import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { login, getOidcStatus, exchangeIdToken, OidcStatus } from '../api';
import { setToken, setRefreshToken, setApiUrl, getApiUrl } from '../config';
import { discover, startDeviceAuthorization, pollForIdToken, tryOpenBrowser } from '../sso';

export async function loginCommand(options: {
  email?: string;
  apiUrl?: string;
  password?: boolean;
}): Promise<void> {
  console.log(chalk.bold('\nSecret Vault Login\n'));

  // Set API URL if provided
  if (options.apiUrl) {
    setApiUrl(options.apiUrl);
    console.log(chalk.gray(`API URL: ${options.apiUrl}`));
  } else {
    console.log(chalk.gray(`API URL: ${getApiUrl()}`));
  }

  // SSO (device flow) is the default whenever the server has it enabled;
  // --password forces the legacy email/password prompt.
  let sso: OidcStatus = { enabled: false };
  if (!options.password) {
    try {
      sso = await getOidcStatus();
    } catch {
      // Older servers without the endpoint (or unreachable): fall through to
      // password login, which will surface the real error.
    }
  }

  if (sso.enabled && sso.issuer && sso.cliClientId) {
    await ssoLogin(sso.issuer, sso.cliClientId);
  } else {
    if (!options.password && sso.enabled) {
      console.log(chalk.yellow('SSO is enabled but the server did not provide device-flow details; falling back to password login.'));
    }
    await passwordLogin(options.email);
  }
}

async function ssoLogin(issuer: string, clientId: string): Promise<void> {
  let spinner = ora('Contacting SSO provider...').start();

  try {
    const discovery = await discover(issuer);
    const auth = await startDeviceAuthorization(discovery, clientId);
    spinner.stop();

    const verificationUrl = auth.verification_uri_complete ?? auth.verification_uri;
    console.log(`\nOpen this URL in your browser to approve the login:\n`);
    console.log(`  ${chalk.cyan(verificationUrl)}\n`);
    console.log(`Code: ${chalk.bold(auth.user_code)}\n`);
    tryOpenBrowser(verificationUrl);

    spinner = ora('Waiting for browser approval...').start();
    const idToken = await pollForIdToken(discovery, clientId, auth);

    spinner.text = 'Signing in to vault...';
    const response = await exchangeIdToken(idToken);
    setToken(response.accessToken);
    setRefreshToken(response.refreshToken);

    spinner.succeed(chalk.green('Login successful!'));
    console.log(chalk.gray(`\nLogged in as ${response.user.name} (${response.user.email})`));
    console.log(chalk.gray('\nRun `vault setup` to configure your project.'));
  } catch (error: unknown) {
    spinner.fail(chalk.red('SSO login failed'));
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    console.error(chalk.red(err.response?.data?.message || err.message || 'SSO login failed'));
    console.error(chalk.gray('Tip: `vault login --password` uses email/password instead.'));
    process.exit(1);
  }
}

async function passwordLogin(defaultEmail?: string): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      default: defaultEmail,
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
