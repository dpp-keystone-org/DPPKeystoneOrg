# Minimal Container for Cloud Run API Service
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy runtime server code and specification data
COPY api ./api
COPY src ./src

# Security: Run as non-root user
USER node

EXPOSE 8080

CMD ["node", "api/src/server.js"]

