# Stage 1: Build & Distribute Clean Spec Artifacts
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY scripts ./scripts
COPY src ./src
RUN npm run build

# Stage 2: Production Minimal Container for Cloud Run
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy runtime server code and shared utilities
COPY api ./api
COPY src/util ./src/util
COPY src/lib/keystone-version.js ./src/lib/keystone-version.js
COPY --from=builder /app/dist ./dist

# Security: Run as non-root user
USER node

EXPOSE 8080

CMD ["node", "api/src/server.js"]
