# Minimal Container for Cloud Run API Service
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --workspaces=false && npm cache clean --force

# Copy runtime server code, specification data, and EC bundles (patched + raw)
COPY api ./api
COPY src ./src
COPY ec-bundle ./ec-bundle
COPY ec-bundle-raw ./ec-bundle-raw

# Security: Run as non-root user
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "api/src/server.js"]

