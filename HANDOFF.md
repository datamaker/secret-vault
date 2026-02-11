# Secret Vault - Handoff Document

## 프로젝트 개요
Secret Vault는 Doppler의 대안으로 개발된 시크릿 관리 시스템입니다.

## 기술 스택
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **배포**: Docker + Docker Compose

## 최근 완료된 작업

### 1. Export/Import 기능 수정
- **문제**: Export/Import 기능이 작동하지 않음
- **원인**:
  - 라우트 순서 문제 (`/secrets/export`가 `/secrets/:key` 뒤에 있어서 "export"가 key로 인식됨)
  - Import 버튼에 onClick 핸들러 누락
- **수정 파일**:
  - `apps/backend/src/routes/secrets.ts` - 라우트 순서 변경
  - `apps/frontend/src/pages/Secrets.tsx` - Import 모달 UI 및 mutation 추가
  - `apps/backend/src/services/secretService.ts` - upsert 지원 (기존 키 업데이트)

### 2. Docker Compose v2 마이그레이션
- **문제**: docker-compose v1과 buildx 멀티플랫폼 이미지 호환성 문제 (`KeyError: 'ContainerConfig'`)
- **해결**: Docker Compose v2 사용 (`docker compose` 명령어)
- **수정 파일**:
  - `README.md` - 전체 문서에서 `docker-compose` → `docker compose`
  - `docker-compose.yml`, `docker-compose.dev.yml`, `install/docker-compose.yml` - `version: '3.8'` 제거
  - `install/install.sh` - `docker compose` 사용

### 3. 데이터베이스 로컬 영속성
- **변경**: Docker named volume → 로컬 bind mount
- **경로**: `./data/postgres`
- **수정 파일**: `install/docker-compose.yml`, `install/install.sh`

### 4. Rate Limiting 수정
- **문제**: 429 Too Many Requests 에러
- **해결**:
  - Rate limit 증가: 100 → 1000 requests/15min
  - `app.set('trust proxy', 1)` 추가 (nginx 뒤에서 실제 클라이언트 IP 인식)
- **수정 파일**: `apps/backend/src/app.ts`

### 5. 무한 API 요청 루프 수정
- **문제**: 로그인 시 `/auth/refresh` 무한 호출
- **원인**: refresh 엔드포인트가 401 반환 시 인터셉터가 다시 refresh 호출
- **해결**:
  - `/auth/refresh` 엔드포인트 재시도 제외
  - `isRefreshing` 플래그로 동시 refresh 방지
  - 요청 큐 추가 (refresh 중 들어오는 요청 대기)
- **수정 파일**: `apps/frontend/src/api/client.ts`

## 배포 정보

### Docker Hub 이미지
- `datamaker/secret-vault-frontend:latest`
- `datamaker/secret-vault-backend:latest`
- 지원 플랫폼: linux/amd64, linux/arm64

### 서버 업데이트 방법
```bash
cd /path/to/install
docker compose pull
docker compose down && docker compose up -d
```

## 주요 파일 구조
```
secret-vault/
├── apps/
│   ├── frontend/          # React 프론트엔드
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   └── client.ts    # Axios 인스턴스 + 인터셉터
│   │   │   ├── pages/
│   │   │   │   └── Secrets.tsx  # 시크릿 관리 페이지
│   │   │   └── store/
│   │   │       └── authStore.ts # Zustand 인증 상태
│   │   └── Dockerfile
│   └── backend/           # Express 백엔드
│       ├── src/
│       │   ├── app.ts           # Express 앱 설정
│       │   ├── routes/
│       │   │   └── secrets.ts   # 시크릿 API 라우트
│       │   └── services/
│       │       └── secretService.ts
│       └── Dockerfile
├── packages/
│   └── shared/            # 공유 타입/유틸리티
├── install/               # 설치 스크립트
│   ├── docker-compose.yml
│   └── install.sh
└── README.md
```

## 알려진 이슈
- 없음 (모든 이슈 해결됨)

## 다음 작업 제안
- 시크릿 버전 히스토리 기능
- 팀별 권한 관리 강화
- CLI 도구 개발
- GitHub Actions CI/CD 파이프라인

---
마지막 업데이트: 2026-02-11
