# @datasee/vault

A Doppler alternative - Secret management CLI tool

Securely manage environment variables and API keys, and collaborate with your team.

## Installation

```bash
npm install -g @datasee/vault
```

## Quick Start

```bash
# 1. Login
vault login --api-url https://your-server.com

# 2. Setup project
vault setup

# 3. Manage secrets
vault secrets list
vault secrets set API_KEY "your-api-key"
vault secrets get API_KEY

# 4. Run commands with secrets injected
vault run -- npm start
```

## Commands

### Authentication

```bash
# Login
vault login --api-url http://localhost:3000

# Logout
vault logout

# Check current status
vault status
```

### Project Setup

```bash
# Interactive setup (select team, project, environment)
vault setup
```

Creates a `.vault.json` file:
```json
{
  "project": "project-uuid",
  "environment": "environment-uuid"
}
```

### Secret Management

```bash
# List secrets
vault secrets list

# Get value
vault secrets get API_KEY
vault secrets get API_KEY --plain  # Output value only

# Set value
vault secrets set API_KEY "sk-xxx"

# Delete
vault secrets delete API_KEY
```

### Run Commands (with secrets injected)

```bash
# Run commands with secrets as environment variables
vault run -- npm start
vault run -- python app.py
vault run -- ./deploy.sh
```

### Export Environment Variables

```bash
# Shell export format
vault export

# .env file format
vault export -f env

# JSON format
vault export -f json

# Inject into current shell
eval "$(vault export)"
```

## Sharing Project Configuration

Commit `.vault.json` to Git to share project/environment settings with your team.

```bash
git add .vault.json
git commit -m "Add vault configuration"
```

## Server Installation

A Secret Vault server is required to use this CLI.

```bash
git clone https://github.com/datamaker/secret-vault.git
cd secret-vault
docker-compose up -d
```

For detailed installation instructions, see the [GitHub repository](https://github.com/datamaker/secret-vault).

## Key Features

- **AES-256-GCM Encryption** - All secrets are encrypted on the server
- **Team-based Access Control** - Owner/Admin/Member/Viewer roles
- **Multi-environment Support** - Development, Staging, Production environments
- **Easy Integration** - Inject secrets into any command with `vault run`

## License

MIT License

## Links

- [GitHub](https://github.com/datamaker/secret-vault)
- [Issues](https://github.com/datamaker/secret-vault/issues)

---

# 한국어 (Korean)

Doppler 대안 - 시크릿 관리 CLI 도구

환경 변수와 API 키를 안전하게 관리하고, 팀과 협업하세요.

## 설치

```bash
npm install -g @datasee/vault
```

## 빠른 시작

```bash
# 1. 로그인
vault login --api-url https://your-server.com

# 2. 프로젝트 설정
vault setup

# 3. 시크릿 관리
vault secrets list
vault secrets set API_KEY "your-api-key"
vault secrets get API_KEY

# 4. 시크릿 주입하여 명령어 실행
vault run -- npm start
```

## 명령어

### 인증

```bash
# 로그인
vault login --api-url http://localhost:3000

# 로그아웃
vault logout

# 현재 상태 확인
vault status
```

### 프로젝트 설정

```bash
# 대화형 설정 (팀, 프로젝트, 환경 선택)
vault setup
```

`.vault.json` 파일이 생성됩니다:
```json
{
  "project": "project-uuid",
  "environment": "environment-uuid"
}
```

### 시크릿 관리

```bash
# 목록 조회
vault secrets list

# 값 조회
vault secrets get API_KEY
vault secrets get API_KEY --plain  # 값만 출력

# 값 설정
vault secrets set API_KEY "sk-xxx"

# 삭제
vault secrets delete API_KEY
```

### 명령어 실행 (시크릿 주입)

```bash
# 시크릿을 환경변수로 주입하여 명령어 실행
vault run -- npm start
vault run -- python app.py
vault run -- ./deploy.sh
```

### 환경변수 내보내기

```bash
# Shell export 형식
vault export

# .env 파일 형식
vault export -f env

# JSON 형식
vault export -f json

# 현재 셸에 주입
eval "$(vault export)"
```

## 프로젝트 설정 공유

`.vault.json` 파일을 Git에 커밋하면 팀원들과 프로젝트/환경 설정을 공유할 수 있습니다.

```bash
git add .vault.json
git commit -m "Add vault configuration"
```

## 서버 설치

CLI를 사용하려면 Secret Vault 서버가 필요합니다.

```bash
git clone https://github.com/datamaker/secret-vault.git
cd secret-vault
docker-compose up -d
```

자세한 설치 방법은 [GitHub 저장소](https://github.com/datamaker/secret-vault)를 참조하세요.

## 주요 기능

- **AES-256-GCM 암호화** - 모든 시크릿은 서버에서 암호화되어 저장
- **팀 기반 접근 제어** - Owner/Admin/Member/Viewer 역할
- **다중 환경 지원** - Development, Staging, Production 환경 분리
- **간편한 통합** - `vault run`으로 어떤 명령어든 시크릿 주입 가능
