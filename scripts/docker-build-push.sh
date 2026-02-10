#!/bin/bash

# Docker Hub 이미지 빌드 및 푸시 스크립트
# Build and push Docker images to Docker Hub
#
# 사용법: ./scripts/docker-build-push.sh [version]
# 예: ./scripts/docker-build-push.sh 1.0.0

set -e

DOCKER_USERNAME="datamaker"
VERSION=${1:-latest}

# 프로젝트 루트로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=== Building Secret Vault Docker images ==="
echo "Version: $VERSION"
echo "Working directory: $(pwd)"
echo ""

# Backend 빌드 (모노레포 루트에서 빌드)
echo ">>> Building backend..."
docker build \
  -f apps/backend/Dockerfile \
  -t $DOCKER_USERNAME/secret-vault-backend:$VERSION \
  .
docker tag $DOCKER_USERNAME/secret-vault-backend:$VERSION $DOCKER_USERNAME/secret-vault-backend:latest

# Frontend 빌드 (API URL을 빈 값으로 설정하여 nginx 프록시 사용)
echo ">>> Building frontend..."
docker build \
  -f apps/frontend/Dockerfile \
  --build-arg VITE_API_URL="" \
  -t $DOCKER_USERNAME/secret-vault-frontend:$VERSION \
  .
docker tag $DOCKER_USERNAME/secret-vault-frontend:$VERSION $DOCKER_USERNAME/secret-vault-frontend:latest

echo ""
echo "=== Build complete ==="
echo ""

# 푸시 여부 확인
read -p "Push to Docker Hub? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 로그인 확인
    echo ">>> Checking Docker Hub login..."
    docker login

    # 푸시
    echo ">>> Pushing images to Docker Hub..."
    docker push $DOCKER_USERNAME/secret-vault-backend:$VERSION
    docker push $DOCKER_USERNAME/secret-vault-backend:latest
    docker push $DOCKER_USERNAME/secret-vault-frontend:$VERSION
    docker push $DOCKER_USERNAME/secret-vault-frontend:latest

    echo ""
    echo "=== Push complete ==="
    echo ""
    echo "Images pushed:"
    echo "  - $DOCKER_USERNAME/secret-vault-backend:$VERSION"
    echo "  - $DOCKER_USERNAME/secret-vault-backend:latest"
    echo "  - $DOCKER_USERNAME/secret-vault-frontend:$VERSION"
    echo "  - $DOCKER_USERNAME/secret-vault-frontend:latest"
else
    echo ""
    echo "Images built but not pushed:"
    echo "  - $DOCKER_USERNAME/secret-vault-backend:$VERSION"
    echo "  - $DOCKER_USERNAME/secret-vault-frontend:$VERSION"
    echo ""
    echo "To push manually:"
    echo "  docker push $DOCKER_USERNAME/secret-vault-backend:$VERSION"
    echo "  docker push $DOCKER_USERNAME/secret-vault-frontend:$VERSION"
fi
