import { Command } from 'commander';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getClient } from '../api';
import { getApiUrl, getToken, getProject, getEnvironment } from '../config';
import { VERSION } from '../version';

/**
 * MCP 서버 모드. Claude 같은 도구가 vault 를 다룰 수 있게 한다.
 *
 * **시크릿 값은 내주지 않는다.** MCP 로 값을 돌려주면 그 값이 AI 컨텍스트와
 * 대화 기록에 그대로 남는다 — 시크릿 관리 도구에서 이건 유출이다. 여기서는
 * 키·설명·버전·수정 이력 같은 메타데이터만 다루고, 값이 필요하면 사람이
 * `vault run -- <명령>` 이나 `vault export` 로 프로세스 환경에 주입한다.
 * 값은 그 프로세스 안에만 있고 로그에는 안 남는다.
 */
export function mcpCommand(): Command {
  return new Command('mcp')
    .description('Run as an MCP stdio server (metadata only — never returns secret values)')
    .action(async () => {
      const server = new McpServer({ name: 'vault', version: VERSION });
      registerTools(server);
      await server.connect(new StdioServerTransport());
    });
}

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true,
});

async function get<T>(url: string): Promise<T> {
  const { data } = await getClient().get<T>(url);
  return data;
}

function registerTools(server: McpServer) {
  server.tool(
    'vault_status',
    '로그인 상태와 접속 중인 서버, 기본 프로젝트·환경을 본다.',
    {},
    async () => {
      if (!getToken()) {
        return ok({ apiUrl: getApiUrl(), loggedIn: false, hint: '`vault login` 으로 로그인하세요.' });
      }
      try {
        const me = await get<{ email: string; name?: string }>('/auth/me');
        return ok({
          apiUrl: getApiUrl(),
          loggedIn: true,
          user: me,
          defaultProject: getProject() ?? null,
          defaultEnvironment: getEnvironment() ?? null,
        });
      } catch {
        return ok({ apiUrl: getApiUrl(), loggedIn: false, hint: '세션이 만료됐습니다. `vault login`.' });
      }
    }
  );

  server.tool('vault_teams', '팀 목록.', {}, async () => ok(await get('/teams')));

  server.tool(
    'vault_team_members',
    '팀 구성원과 역할. 누가 어떤 시크릿에 접근할 수 있는지 파악할 때 쓴다.',
    { teamId: z.string() },
    async ({ teamId }) => ok(await get(`/teams/${teamId}/members`))
  );

  server.tool(
    'vault_team_activity',
    '팀의 최근 활동 기록 — 누가 언제 무엇을 바꿨나.',
    { teamId: z.string() },
    async ({ teamId }) => ok(await get(`/teams/${teamId}/activity`))
  );

  server.tool('vault_projects', '프로젝트 목록.', {}, async () => ok(await get('/projects')));

  server.tool(
    'vault_environments',
    '프로젝트의 환경 목록(dev/staging/production 등).',
    { projectId: z.string() },
    async ({ projectId }) => ok(await get(`/projects/${projectId}/environments`))
  );

  server.tool(
    'vault_secrets_list',
    '환경에 어떤 시크릿 키가 있는지 본다. **값은 돌려주지 않는다** — 키·설명·버전·수정 시각만.',
    { environmentId: z.string() },
    async ({ environmentId }) => {
      // values=true 를 절대 붙이지 않는다. 붙이면 값이 그대로 딸려 온다.
      const secrets = await get<any[]>(`/environments/${environmentId}/secrets`);
      return ok(
        secrets.map((s) => ({
          key: s.key,
          description: s.description ?? null,
          isSensitive: s.is_sensitive ?? s.isSensitive ?? null,
          version: s.version,
          updatedAt: s.updated_at ?? s.updatedAt,
        }))
      );
    }
  );

  server.tool(
    'vault_secret_history',
    '시크릿 한 건의 변경 이력(값 제외). secretId 는 vault_secrets_list 로 얻는다.',
    { secretId: z.string() },
    async ({ secretId }) => ok(await get(`/secrets/${secretId}/history`))
  );

  server.tool(
    'vault_secret_value',
    '시크릿 값 읽기 — 이 도구는 값을 돌려주지 않는다. 왜 그런지 설명한다.',
    { key: z.string().optional() },
    async ({ key }) =>
      fail(
        [
          `${key ? `"${key}" 의 ` : ''}값은 MCP 로 내주지 않습니다.`,
          '',
          'MCP 응답은 AI 컨텍스트와 대화 기록에 남습니다. 시크릿 값이 거기 들어가면',
          '지울 수 없는 곳에 평문으로 복사되는 셈입니다.',
          '',
          '값이 필요하면 사람이 터미널에서 쓰세요:',
          '  vault run -- <명령>     값을 그 프로세스 환경에만 주입',
          '  vault secrets get <키>  화면에 직접 출력',
        ].join('\n')
      )
  );
}
