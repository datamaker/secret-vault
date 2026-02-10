# Secret Vault

<p align="center">
  <strong>Doppler Alternative - Open Source Secret Management Platform</strong>
</p>

<p align="center">
  Securely manage environment variables and API keys centrally, and collaborate with your team.
</p>

<p align="center">
  <a href="https://hub.docker.com/r/datamaker/secret-vault-backend"><img src="https://img.shields.io/docker/v/datamaker/secret-vault-backend?label=Docker%20Hub&logo=docker" alt="Docker Hub"></a>
  <a href="https://www.npmjs.com/package/@datasee/vault"><img src="https://img.shields.io/npm/v/@datasee/vault?label=CLI&logo=npm" alt="npm"></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="#한국어-korean">한국어 문서 보기</a>
</p>

---

## Key Features

- **AES-256-GCM Encryption** - All secrets are stored encrypted
- **Team-based Access Control** - Owner/Admin/Member/Viewer roles
- **Multi-environment Support** - Development, Staging, Production environments
- **Project Structure** - Team > Project > Environment > Secret hierarchy
- **CLI Tool** - Command-line tool for development workflow integration
- **Team Invitations** - Invite unregistered users (auto-added on signup)
- **Import/Export** - .env file format support

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js, Express, TypeScript |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Database | PostgreSQL |
| Deployment | Docker Compose |
| Encryption | AES-256-GCM, HKDF |

## Docker Images

| Image | Description |
|-------|-------------|
| `datamaker/secret-vault-backend` | Backend API server |
| `datamaker/secret-vault-frontend` | Frontend web application |

---

## Quick Start

### Option 1: One-liner Installation (Recommended)

The fastest way to get started. Downloads config files and generates secure keys automatically.

```bash
curl -sSL https://raw.githubusercontent.com/datamaker/secret-vault/main/install/install.sh | bash
```

```bash
cd secret-vault && docker-compose up -d
```

Access: **http://localhost**

### Option 2: Manual Installation

```bash
# 1. Create directory
mkdir secret-vault && cd secret-vault

# 2. Download docker-compose.yml
curl -sSL https://raw.githubusercontent.com/datamaker/secret-vault/main/install/docker-compose.yml -o docker-compose.yml
curl -sSL https://raw.githubusercontent.com/datamaker/secret-vault/main/install/init.sql -o init.sql

# 3. Create .env file with secure keys
cat > .env << EOF
POSTGRES_USER=vault
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=secret_vault

DATABASE_URL=postgres://vault:$(openssl rand -hex 16)@db:5432/secret_vault
MASTER_ENCRYPTION_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=http://localhost
EOF

# 4. Run
docker-compose up -d
```

### Option 3: Docker Run (Without Compose)

```bash
# 1. Create network
docker network create secret-vault-network

# 2. Run PostgreSQL
docker run -d --name secret-vault-db \
  --network secret-vault-network \
  -e POSTGRES_USER=vault \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=secret_vault \
  -v secret-vault-data:/var/lib/postgresql/data \
  postgres:16-alpine

# 3. Run Backend
docker run -d --name secret-vault-backend \
  --network secret-vault-network \
  -e DATABASE_URL=postgres://vault:your_password@secret-vault-db:5432/secret_vault \
  -e MASTER_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e JWT_REFRESH_SECRET=$(openssl rand -hex 32) \
  -p 3000:3000 \
  datamaker/secret-vault-backend:latest

# 4. Run Frontend
docker run -d --name secret-vault-frontend \
  --network secret-vault-network \
  -p 80:80 \
  datamaker/secret-vault-frontend:latest
```

---

## CLI Installation

```bash
npm install -g @datasee/vault
```

### CLI Commands

```bash
# Login
vault login --api-url http://localhost:3000

# Setup project
vault setup

# Manage secrets
vault secrets list                    # List
vault secrets get API_KEY             # Get value
vault secrets get API_KEY --plain     # Get value only
vault secrets set API_KEY "sk-xxx"    # Set value
vault secrets delete API_KEY          # Delete

# Run with secrets injected
vault run -- npm start
vault run -- python app.py

# Export
vault export                          # shell format
vault export -f env                   # .env format
vault export -f json                  # JSON format
```

---

## Security

### Encryption Architecture

```
Master Key (env variable)
    │
    ├─ HKDF ──► Project DEK (unique per project)
    │               │
    │               └─ AES-256-GCM ──► Encrypted secrets
    │
    └─ Exists only in server memory (not stored in DB)
```

### Authentication

- **Access Token**: 15 min expiry
- **Refresh Token**: 7 day expiry, HttpOnly Cookie
- **Password**: bcrypt (rounds: 12)

### Permissions (RBAC)

| Role | Team Mgmt | Project Mgmt | Write Secrets | Read Secrets |
|------|-----------|--------------|---------------|--------------|
| Owner | O | O | O | O |
| Admin | O | O | O | O |
| Member | X | X | O | O |
| Viewer | X | X | X | O |

---

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user

### Teams
- `GET /api/v1/teams` - List teams
- `POST /api/v1/teams` - Create team
- `GET /api/v1/teams/:id/members` - List members
- `POST /api/v1/teams/:id/members` - Add/invite member
- `DELETE /api/v1/teams/:id/members/:userId` - Remove member

### Projects
- `GET /api/v1/projects/teams/:teamId/projects` - List projects
- `POST /api/v1/projects/teams/:teamId/projects` - Create project

### Secrets
- `GET /api/v1/environments/:envId/secrets` - List secrets
- `POST /api/v1/environments/:envId/secrets` - Create secret
- `PUT /api/v1/environments/:envId/secrets/:key` - Update secret
- `DELETE /api/v1/environments/:envId/secrets/:key` - Delete secret

---

## License

MIT License - Free to use, modify, and distribute.

---

## Related Projects

- [Doppler](https://www.doppler.com/) - Commercial secret management service
- [Infisical](https://infisical.com/) - Open source secret management
- [Vault](https://www.vaultproject.io/) - HashiCorp's secret management tool

---

# 한국어 (Korean)

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

## Docker 이미지

| 이미지 | 설명 |
|--------|------|
| `datamaker/secret-vault-backend` | 백엔드 API 서버 |
| `datamaker/secret-vault-frontend` | 프론트엔드 웹 애플리케이션 |

---

## 빠른 시작

### 방법 1: 원라인 설치 (권장)

가장 빠른 방법입니다. 설정 파일 다운로드와 보안 키 생성을 자동으로 처리합니다.

```bash
curl -sSL https://raw.githubusercontent.com/datamaker/secret-vault/main/install/install.sh | bash
```

```bash
cd secret-vault && docker-compose up -d
```

접속: **http://localhost**

### 방법 2: 수동 설치

```bash
# 1. 디렉토리 생성
mkdir secret-vault && cd secret-vault

# 2. docker-compose.yml 다운로드
curl -sSL https://raw.githubusercontent.com/datamaker/secret-vault/main/install/docker-compose.yml -o docker-compose.yml
curl -sSL https://raw.githubusercontent.com/datamaker/secret-vault/main/install/init.sql -o init.sql

# 3. 보안 키가 포함된 .env 파일 생성
cat > .env << EOF
POSTGRES_USER=vault
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=secret_vault

DATABASE_URL=postgres://vault:$(openssl rand -hex 16)@db:5432/secret_vault
MASTER_ENCRYPTION_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=http://localhost
EOF

# 4. 실행
docker-compose up -d
```

### 방법 3: Docker Run (Compose 없이)

```bash
# 1. 네트워크 생성
docker network create secret-vault-network

# 2. PostgreSQL 실행
docker run -d --name secret-vault-db \
  --network secret-vault-network \
  -e POSTGRES_USER=vault \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=secret_vault \
  -v secret-vault-data:/var/lib/postgresql/data \
  postgres:16-alpine

# 3. 백엔드 실행
docker run -d --name secret-vault-backend \
  --network secret-vault-network \
  -e DATABASE_URL=postgres://vault:your_password@secret-vault-db:5432/secret_vault \
  -e MASTER_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e JWT_REFRESH_SECRET=$(openssl rand -hex 32) \
  -p 3000:3000 \
  datamaker/secret-vault-backend:latest

# 4. 프론트엔드 실행
docker run -d --name secret-vault-frontend \
  --network secret-vault-network \
  -p 80:80 \
  datamaker/secret-vault-frontend:latest
```

---

## 서버 설치 가이드

### EC2 / Linux 서버

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

#### 2단계: Secret Vault 설치 (원라인)

```bash
curl -sSL https://raw.githubusercontent.com/datamaker/secret-vault/main/install/install.sh | bash
cd secret-vault
docker-compose up -d
```

#### 3단계: 접속 확인

```bash
# 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

접속: `http://YOUR_SERVER_IP`

#### 4단계: 방화벽 설정

```bash
# Ubuntu (UFW)
sudo ufw allow 80  # HTTP

# Amazon Linux (Security Group에서 설정)
# AWS Console > EC2 > Security Groups > Inbound Rules
# - 80 포트 허용
```

#### HTTPS 설정 (선택사항)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# /etc/nginx/sites-available/secret-vault
server {
    server_name vault.yourdomain.com;

    location / {
        proxy_pass http://localhost;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
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

### macOS / Windows

<details>
<summary>클릭하여 펼치기</summary>

#### Docker Desktop 사용 (권장)

1. **Docker Desktop 설치**
   - https://www.docker.com/products/docker-desktop 에서 다운로드

2. **터미널에서 설치 스크립트 실행**

```bash
curl -sSL https://raw.githubusercontent.com/datamaker/secret-vault/main/install/install.sh | bash
cd secret-vault
docker-compose up -d
```

3. **접속**: http://localhost

#### Windows PowerShell (curl 없는 경우)

```powershell
# 1. 디렉토리 생성
mkdir secret-vault; cd secret-vault

# 2. 파일 다운로드
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/datamaker/secret-vault/main/install/docker-compose.yml" -OutFile "docker-compose.yml"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/datamaker/secret-vault/main/install/init.sql" -OutFile "init.sql"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/datamaker/secret-vault/main/install/.env.example" -OutFile ".env"

# 3. .env 파일 편집 (메모장으로 열어서 키 생성 후 입력)
notepad .env

# 4. 실행
docker-compose up -d
```

</details>

---

### 소스에서 빌드 (개발자용)

<details>
<summary>클릭하여 펼치기</summary>

```bash
# 1. 저장소 클론
git clone https://github.com/datamaker/secret-vault.git
cd secret-vault

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일 편집하여 키 생성

# 4. 개발 서버 실행
npm run dev:backend   # 터미널 1
npm run dev:frontend  # 터미널 2

# 5. 접속
# - 웹 UI: http://localhost:5174
# - API: http://localhost:3000
```

</details>

---

### Kubernetes (Helm)

<details>
<summary>클릭하여 펼치기</summary>

```bash
# 준비 중...
# Helm 차트는 향후 제공될 예정입니다.
```

</details>

---

### 중요: 백업

⚠️ **MASTER_ENCRYPTION_KEY를 반드시 백업하세요!**

이 키가 없으면 저장된 시크릿을 복호화할 수 없습니다.

```bash
# .env 파일 백업
cp .env .env.backup

# 안전한 곳에 보관
cat .env | grep MASTER_ENCRYPTION_KEY
```

---

### 삭제

```bash
# 서비스 중지 및 삭제
docker-compose down

# 데이터 포함 완전 삭제
docker-compose down -v
rm -rf secret-vault
```

</details>

---

## CLI 사용법

### 설치

```bash
# 프로젝트 내에서
cd apps/cli
npm link

# 또는 npm 글로벌 설치
npm install -g @datasee/vault
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
