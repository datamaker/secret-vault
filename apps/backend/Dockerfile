# Build from monorepo root: docker build -f apps/backend/Dockerfile .
FROM node:20-alpine AS builder

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
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built files and dependencies from root node_modules (npm workspaces hoists deps)
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs
USER expressjs

EXPOSE 3000

CMD ["node", "dist/index.js"]
