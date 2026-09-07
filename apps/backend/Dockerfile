# Build from monorepo root: docker build -f apps/backend/Dockerfile .
FROM node:24-alpine AS builder

WORKDIR /app

# Copy all package files for workspace resolution
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Install and build
WORKDIR /app
RUN npm install

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Build backend
WORKDIR /app/apps/backend
RUN npm run build

# Production stage
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built files and dependencies from root node_modules (npm workspaces hoists deps)
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy shared package (workspace symlink doesn't work in production)
COPY --from=builder /app/packages/shared/dist ./node_modules/@secret-vault/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@secret-vault/shared/

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs
USER expressjs

EXPOSE 3000
# 사내 서비스 공통 규약: /healthz 로 살아 있는지 본다.
# 이미지에 curl·wget 을 넣지 않으려고 node 내장 fetch 를 쓴다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
