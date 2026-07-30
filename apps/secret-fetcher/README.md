# vault-secret-fetcher

private 서브넷의 vault에서 시크릿을 꺼내 CircleCI 배포 시점에 주입하기 위한 프록시 Lambda.

```
CircleCI (OIDC role) → lambda:Invoke → vault-secret-fetcher (VPC 내부)
                                          → vault export (스코프 API 토큰)
                       ← { secrets: {KEY: value} }
→ source secrets.env && serverless deploy
```

AWS 쪽에 저장되는 크리덴셜은 vault가 발급한 **read-only 스코프 API 토큰 하나**뿐이며,
나머지 시크릿은 전부 배포 시점에 vault에서 실시간 조회한다.
람다는 VPC 안에서 vault만 호출하므로 NAT 게이트웨이나 VPC 엔드포인트가 필요 없다.

## 1회 설정

### 1. vault에서 API 키 발급

vault UI에서 **팀 페이지 → API Keys 탭 → New API Key** (팀 admin/owner만 가능).
팀 스코프 키는 팀 내 모든 프로젝트를 읽을 수 있어서, **fetcher 람다 하나(스테이지당)로
팀 전체 프로젝트의 배포를 커버**한다. 키 원문은 생성 직후 한 번만 표시되며, 같은 탭에서
폐기(revoke)할 수 있다.

더 좁은 스코프(프로젝트/환경 단위)가 필요하면 API로 발급한다:

```bash
curl -s -X POST https://<vault-url>/api/v1/projects/<projectId>/tokens \
  -H "Authorization: Bearer <accessToken>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"circleci-prod","environmentId":"<envId>","permissions":["read"]}'
```

### 2. fetcher 람다 배포

vault가 있는 VPC 정보가 필요하다:

- **서브넷**: vault EC2와 통신 가능한 private 서브넷
- **보안 그룹**: 새로 하나 만들고, vault 쪽 SG에서 이 SG로부터의 인바운드(백엔드 포트, 예: 3000)를 허용

```bash
cd apps/secret-fetcher

export FETCHER_SECURITY_GROUP_ID=sg-xxxx
export FETCHER_SUBNET_ID_A=subnet-xxxx
export FETCHER_SUBNET_ID_B=subnet-yyyy
export VAULT_BASE_URL=http://<vault-internal-ip>:3000
export VAULT_API_KEY=sv_...   # 1단계에서 발급한 토큰

npx serverless deploy --stage prod
```

스테이지별 권한 분리는 **토큰 스코프 + 함수 분리**로 한다: dev용은 dev 환경으로 스코프된
별도 토큰을 발급해 `--stage dev`로 한 번 더 배포한다. (람다 안에서는 호출자를 구분할 수
없으므로, 함수 분리가 유일한 확실한 권한 경계다.)

## CircleCI에서 사용

`circleci-prod-deploy-role`에 이미 `lambda:*`가 있으므로 IAM 변경 없이 동작한다.

```yaml
# .circleci/config.yml (배포 잡 일부)
- run:
    name: Fetch secrets from vault
    command: |
      chmod +x ./apps/secret-fetcher/ci/fetch-secrets.sh
      ./apps/secret-fetcher/ci/fetch-secrets.sh \
        vault-secret-fetcher-prod \
        "$VAULT_ENV_ID" \
        /tmp/secrets.env
- run:
    name: Deploy
    command: |
      source /tmp/secrets.env
      npx serverless deploy --stage prod
```

`VAULT_ENV_ID`는 CircleCI 프로젝트 환경변수로 등록한다 (UUID라 민감정보 아님).

소비하는 앱의 `serverless.yml`에서는 환경변수로 참조한다:

```yaml
provider:
  environment:
    DATABASE_URL: ${env:DATABASE_URL}
    SOME_API_KEY: ${env:SOME_API_KEY}
```

## 보안 메모

- API 토큰은 vault DB에 SHA-256 해시로만 저장되고, 원문은 발급 응답에서 한 번만 반환된다.
- 토큰은 read 권한만 가질 수 있고(쓰기 엔드포인트는 JWT 사용자 전용), 스코프 밖
  프로젝트/환경 접근은 vault가 403으로 거부한다.
- 토큰 원문은 fetcher 람다의 환경변수에 들어간다. `lambda:GetFunctionConfiguration`
  권한이 있으면 읽을 수 있으므로, 유출이 의심되면 즉시 revoke 후 재발급한다.
- 이 람다를 invoke할 수 있으면 토큰 스코프 범위의 시크릿을 전부 읽을 수 있다.
  현재 CI 역할의 `lambda:*` / `Resource: *`는 과도하므로, 추후 배포 대상 함수 ARN 패턴 +
  이 함수 ARN으로 좁히는 것을 권장.
- 시크릿은 최종적으로 배포된 Lambda의 환경변수에 들어간다. 계정 내 read 권한 관리에 유의.
- 핸들러/CI 스크립트는 시크릿 값을 로그에 남기지 않는다. 수정 시에도 이 원칙 유지.
