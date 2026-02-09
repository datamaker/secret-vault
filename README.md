# Secret Vault

<p align="center">
  <strong>Doppler 대안 - 오픈소스 시크릿 관리 플랫폼</strong>
</p>

<p align="center">
  환경 변수와 API 키를 안전하게 중앙에서 관리하고, 팀과 협업하세요.
</p>

---

## 주요 기능

- **AES-256-GCM 암호화** - 모든 시크릿은 암호화되어 저장
- **팀 기반 접근 제어** - Owner/Admin/Member/Viewer 역할 지원
- **다중 환경 지원** - Development, Staging, Production 환경 분리
- **프로젝트 구조** - 팀 > 프로젝트 > 환경 > 시크릿 계층 구조
- **CLI 도구** - 개발 워크플로우에 통합 가능한 명령줄 도구
- **팀원 초대** - 미등록 사용자도 초대 가능 (가입 시 자동 추가)
- **Import/Export** - .env 파일 형식 지원

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Node.js, Express, TypeScript |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Database | PostgreSQL |
| Deployment | Docker Compose |
| Encryption | AES-256-GCM, HKDF |

---

## 빠른 시작 (Docker)

가장 빠르게 시작하는 방법입니다.

```bash
# 1. 저장소 클론
git clone https://github.com/YOUR_USERNAME/secret-vault.git
cd secret-vault

# 2. 환경 변수 설정
cp .env.example .env

# 3. 암호화 키 생성 및 .env에 입력
openssl rand -hex 32  # MASTER_ENCRYPTION_KEY
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # JWT_REFRESH_SECRET

# 4. Docker Compose로 실행
docker-compose up -d

# 5. 접속
# - 웹 UI: http://localhost:5173
# - API: http://localhost:3000
```

---

## 설치 가이드

### EC2 / Linux 서버 설치

<details>
<summary>클릭하여 펼치기</summary>

#### 사전 요구사항
- Ubuntu 20.04+ 또는 Amazon Linux 2
- Docker 및 Docker Compose
- 최소 1GB RAM, 10GB 디스크

#### 1단계: Docker 설치

```bash
# Ubuntu
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Amazon Linux 2
sudo yum update -y
sudo amazon-linux-extras install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# 재로그인 필요
exit
```

#### 2단계: Secret Vault 설치

```bash
# 저장소 클론
git clone https://github.com/YOUR_USERNAME/secret-vault.git
cd secret-vault

# 환경 변수 설정
cp .env.example .env
nano .env  # 또는 vim .env
```

#### 3단계: .env 파일 설정

```bash
# .env 파일 내용
NODE_ENV=production
PORT=3000

# PostgreSQL (Docker가 자동 생성)
DATABASE_URL=postgres://vault:vault_password@db:5432/secret_vault

# 아래 명령어로 생성: openssl rand -hex 32
MASTER_ENCRYPTION_KEY=여기에_64자_hex_문자열
JWT_SECRET=여기에_64자_hex_문자열
JWT_REFRESH_SECRET=여기에_64자_hex_문자열

# 프론트엔드 URL (CORS)
CORS_ORIGIN=http://YOUR_SERVER_IP:5173
```

#### 4단계: 실행

```bash
# 프로덕션 모드로 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 상태 확인
docker-compose ps
```

#### 5단계: 방화벽 설정

```bash
# Ubuntu (UFW)
sudo ufw allow 5173  # Frontend
sudo ufw allow 3000  # Backend API

# Amazon Linux (Security Group에서 설정)
# AWS Console > EC2 > Security Groups > Inbound Rules
# - 5173 포트 허용
# - 3000 포트 허용
```

#### Nginx 리버스 프록시 (선택사항)

HTTPS와 도메인을 사용하려면:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# /etc/nginx/sites-available/secret-vault
server {
    server_name vault.yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# 활성화 및 SSL 인증서 발급
sudo ln -s /etc/nginx/sites-available/secret-vault /etc/nginx/sites-enabled/
sudo certbot --nginx -d vault.yourdomain.com
sudo systemctl restart nginx
```

</details>

---

### macOS 설치

<details>
<summary>클릭하여 펼치기</summary>

#### 방법 1: Docker Desktop 사용 (권장)

```bash
# 1. Docker Desktop 설치
# https://www.docker.com/products/docker-desktop 에서 다운로드

# 2. 저장소 클론
git clone https://github.com/YOUR_USERNAME/secret-vault.git
cd secret-vault

# 3. 환경 변수 설정
cp .env.example .env

# 키 생성
openssl rand -hex 32  # 3번 실행하여 각각 복사

# .env 파일 편집
nano .env

# 4. 실행
docker-compose up -d

# 5. 접속: http://localhost:5173
```

#### 방법 2: 로컬 개발 환경

```bash
# 1. Homebrew로 필수 도구 설치
brew install node@20 postgresql@16

# PostgreSQL 시작
brew services start postgresql@16

# 2. 저장소 클론
git clone https://github.com/YOUR_USERNAME/secret-vault.git
cd secret-vault

# 3. 데이터베이스 생성
createdb secret_vault

# 스키마 적용
psql -d secret_vault -f database/migrations/001_initial_schema.sql
psql -d secret_vault -f database/migrations/002_team_invitations.sql

# 4. 의존성 설치
npm install

# 5. 환경 변수 설정
cp apps/backend/.env.example apps/backend/.env
nano apps/backend/.env

# DATABASE_URL=postgres://YOUR_USERNAME@localhost:5432/secret_vault
# 나머지 키 생성: openssl rand -hex 32

# 6. 빌드 및 실행
npm run build

# 터미널 1: 백엔드
npm run dev:backend

# 터미널 2: 프론트엔드
npm run dev:frontend

# 7. 접속: http://localhost:5174
```

#### CLI 설치

```bash
cd apps/cli
npm link

# 이제 어디서든 사용 가능
vault --help
```

</details>

---

### Windows 설치

<details>
<summary>클릭하여 펼치기</summary>

#### 방법 1: Docker Desktop 사용 (권장)

1. **Docker Desktop 설치**
   - https://www.docker.com/products/docker-desktop 에서 다운로드
   - WSL2 백엔드 사용 권장

2. **Git Bash 또는 WSL 터미널 열기**

```bash
# 저장소 클론
git clone https://github.com/YOUR_USERNAME/secret-vault.git
cd secret-vault

# 환경 변수 설정
cp .env.example .env

# PowerShell에서 키 생성 (Git Bash 없는 경우)
# [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes(32) | ForEach-Object { '{0:x2}' -f $_ } | Join-String

# .env 파일 편집 (메모장 또는 VS Code)
notepad .env

# Docker Compose 실행
docker-compose up -d

# 접속: http://localhost:5173
```

#### 방법 2: WSL2 + Ubuntu

```bash
# 1. WSL2 설치 (PowerShell 관리자 모드)
wsl --install

# 2. Ubuntu 터미널에서 Docker 설치
sudo apt update
sudo apt install -y docker.io docker-compose
sudo service docker start

# 3. 이후 Linux 설치 가이드와 동일
```

#### 방법 3: 로컬 개발 환경

1. **필수 프로그램 설치**
   - Node.js 20+: https://nodejs.org
   - PostgreSQL 16: https://www.postgresql.org/download/windows/
   - Git: https://git-scm.com/download/win

2. **PowerShell에서 실행**

```powershell
# 저장소 클론
git clone https://github.com/YOUR_USERNAME/secret-vault.git
cd secret-vault

# 의존성 설치
npm install

# 환경 변수 설정
copy apps\backend\.env.example apps\backend\.env
notepad apps\backend\.env

# 데이터베이스 생성 (pgAdmin 또는 psql)
# CREATE DATABASE secret_vault;

# 스키마 적용
psql -U postgres -d secret_vault -f database\migrations\001_initial_schema.sql

# 빌드
npm run build

# 실행 (별도 터미널)
npm run dev:backend
npm run dev:frontend
```

</details>

---

## CLI 사용법

### 설치

```bash
# 프로젝트 내에서
cd apps/cli
npm link

# 또는 npm 글로벌 설치 (배포 후)
npm install -g @secret-vault/cli
```

### 명령어

```bash
# 로그인
vault login --api-url http://localhost:3000

# 프로젝트 설정
vault setup

# 시크릿 관리
vault secrets list                    # 목록 조회
vault secrets get API_KEY             # 값 조회
vault secrets get API_KEY --plain     # 값만 출력
vault secrets set API_KEY "sk-xxx"    # 값 설정
vault secrets delete API_KEY          # 삭제

# 명령어 실행 (시크릿 주입)
vault run -- npm start
vault run -- python app.py
vault run -- ./deploy.sh

# 환경변수 내보내기
vault export                          # shell 형식
vault export -f env                   # .env 형식
vault export -f json                  # JSON 형식

# 현재 셸에 주입
eval "$(vault export)"
```

### 프로젝트 설정 파일

`vault setup` 실행 후 `.vault.json` 파일이 생성됩니다:

```json
{
  "project": "project-uuid",
  "environment": "environment-uuid"
}
```

이 파일을 Git에 커밋하면 팀원들과 설정을 공유할 수 있습니다.

---

## 프로젝트 구조

```
secret-vault/
├── apps/
│   ├── backend/          # Express API 서버
│   │   └── src/
│   │       ├── controllers/
│   │       ├── middleware/
│   │       ├── routes/
│   │       └── services/
│   ├── frontend/         # React 웹 애플리케이션
│   │   └── src/
│   │       ├── api/
│   │       ├── components/
│   │       ├── pages/
│   │       └── store/
│   └── cli/              # 명령줄 도구
├── packages/
│   └── shared/           # 공유 타입 및 상수
├── database/
│   └── migrations/       # SQL 마이그레이션
├── docker-compose.yml    # 프로덕션 설정
└── docker-compose.dev.yml # 개발 설정
```

---

## 환경 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 URL | `postgres://user:pass@host:5432/db` |
| `MASTER_ENCRYPTION_KEY` | 마스터 암호화 키 (64자 hex) | `openssl rand -hex 32` |
| `JWT_SECRET` | JWT 서명 키 | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Refresh Token 서명 키 | `openssl rand -hex 32` |
| `CORS_ORIGIN` | 허용할 프론트엔드 URL | `http://localhost:5173` |
| `PORT` | 백엔드 포트 | `3000` |

---

## 보안

### 암호화 구조

```
Master Key (환경변수)
    │
    ├─ HKDF ──► Project DEK (프로젝트별 고유 키)
    │               │
    │               └─ AES-256-GCM ──► 암호화된 시크릿
    │
    └─ 서버 메모리에만 존재 (DB에 저장되지 않음)
```

### 인증

- **Access Token**: 15분 만료
- **Refresh Token**: 7일 만료, HttpOnly Cookie
- **비밀번호**: bcrypt (rounds: 12)

### 권한 (RBAC)

| 역할 | 팀 관리 | 프로젝트 관리 | 시크릿 쓰기 | 시크릿 읽기 |
|------|---------|---------------|-------------|-------------|
| Owner | O | O | O | O |
| Admin | O | O | O | O |
| Member | X | X | O | O |
| Viewer | X | X | X | O |

---

## API 엔드포인트

### 인증
- `POST /api/v1/auth/register` - 회원가입
- `POST /api/v1/auth/login` - 로그인
- `POST /api/v1/auth/logout` - 로그아웃
- `POST /api/v1/auth/refresh` - 토큰 갱신
- `GET /api/v1/auth/me` - 내 정보

### 팀
- `GET /api/v1/teams` - 팀 목록
- `POST /api/v1/teams` - 팀 생성
- `GET /api/v1/teams/:id/members` - 팀원 목록
- `POST /api/v1/teams/:id/members` - 팀원 추가/초대
- `DELETE /api/v1/teams/:id/members/:userId` - 팀원 제거

### 프로젝트
- `GET /api/v1/projects/teams/:teamId/projects` - 프로젝트 목록
- `POST /api/v1/projects/teams/:teamId/projects` - 프로젝트 생성

### 시크릿
- `GET /api/v1/environments/:envId/secrets` - 시크릿 목록
- `POST /api/v1/environments/:envId/secrets` - 시크릿 생성
- `PUT /api/v1/environments/:envId/secrets/:key` - 시크릿 수정
- `DELETE /api/v1/environments/:envId/secrets/:key` - 시크릿 삭제

---

## 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev:backend   # 백엔드 (포트 3000)
npm run dev:frontend  # 프론트엔드 (포트 5174)

# 빌드
npm run build

# CLI 빌드
npm run build:cli
```

---

## 기여하기

1. Fork 하기
2. Feature 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 커밋 (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request 열기

---

## 라이선스

MIT License - 자유롭게 사용, 수정, 배포할 수 있습니다.

---

## 관련 프로젝트

- [Doppler](https://www.doppler.com/) - 상용 시크릿 관리 서비스
- [Infisical](https://infisical.com/) - 오픈소스 시크릿 관리
- [Vault](https://www.vaultproject.io/) - HashiCorp의 시크릿 관리 도구
