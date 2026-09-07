# 백엔드 + 웹 UI 한 이미지.
#
# 예전에는 nginx 컨테이너가 정적 파일을 서빙하고 /api 를 백엔드로 프록시했다.
# 프런트가 이미 상대경로(/api/v1)를 쓰고 있어서 합쳐도 브라우저가 보는 것은
# 같고, 프록시 한 단계와 이미지 하나가 없어진다.
#
# 레포 루트에서 빌드한다: docker build -t datamaker/vault .
FROM node:24-alpine AS build

WORKDIR /app

# 워크스페이스 해석에 필요한 매니페스트를 먼저 — 소스가 바뀌어도 설치 레이어는 산다.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY apps/cli/package.json apps/cli/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/backend apps/backend
COPY apps/frontend apps/frontend

RUN npm run build -w @secret-vault/shared \
 && npm run build -w @secret-vault/backend \
 && npm run build -w @secret-vault/frontend

FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY apps/cli/package.json apps/cli/
RUN npm ci --omit=dev --workspace @secret-vault/backend && npm cache clean --force

COPY --from=build /app/apps/backend/dist apps/backend/dist
# shared 는 워크스페이스 심볼릭 링크라 프로덕션에선 직접 넣어 준다.
COPY --from=build /app/packages/shared/dist packages/shared/dist
# 웹 UI — 백엔드가 express.static 으로 서빙한다.
COPY --from=build /app/apps/frontend/dist apps/backend/public

# 컨테이너 안에서 root 로 돌 이유가 없다.
USER node
EXPOSE 3000
# 사내 서비스 공통 규약: /healthz 로 살아 있는지 본다.
# 이미지에 curl·wget 을 넣지 않으려고 node 내장 fetch 를 쓴다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/backend/dist/index.js"]
