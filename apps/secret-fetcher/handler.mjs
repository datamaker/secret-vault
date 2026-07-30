// 주의: 이 함수는 시크릿 값을 반환한다.
// 어떤 경우에도 시크릿 값(응답 본문, export 결과)을 console.log 하지 말 것.
//
// 인증은 vault에서 발급한 프로젝트/환경 스코프 API 토큰(sv_...)으로 한다.
// 접근 범위는 vault 서버가 토큰 스코프로 강제하므로, 이 함수는 단순 프록시다.

export const handler = async (event) => {
  const envId = event?.envId;
  if (!envId || typeof envId !== 'string') {
    throw new Error('event.envId is required');
  }

  const baseUrl = process.env.VAULT_BASE_URL.replace(/\/$/, '');
  const apiKey = process.env.VAULT_API_KEY;
  if (!apiKey) {
    throw new Error('VAULT_API_KEY is not configured');
  }

  const res = await fetch(
    `${baseUrl}/api/v1/environments/${encodeURIComponent(envId)}/secrets/export?format=json`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.message ? `: ${body.message}` : '';
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(`Vault export failed with status ${res.status}${detail}`);
  }

  const secrets = await res.json();

  console.log(`Exported ${Object.keys(secrets).length} secrets for envId=${envId}`);

  return { envId, secrets };
};
