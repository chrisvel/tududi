###############
# BUILD STAGE #
###############
FROM node:22-alpine AS builder

# Install build dependencies for native modules (sqlite3)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install ALL dependencies (needed for build)
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . ./

# Build frontend
RUN NODE_ENV=production npm run frontend:build

# Remove dev dependencies after build
RUN npm prune --omit=dev && \
    npm cache clean --force


##########################
# PRODUCTION STAGE       #
##########################
FROM node:22-alpine AS production

ENV APP_UID=1001 \
    APP_GID=1001

# Install runtime dependencies only
RUN apk add --no-cache \
    sqlite \
    dumb-init \
    curl \
    bash \
    su-exec && \
    rm -rf /var/cache/apk/*

# Create app user and group
RUN addgroup -g ${APP_GID} app && \
    adduser -D -u ${APP_UID} -G app app

WORKDIR /app

# Copy backend source
COPY --chown=app:app ./backend/ /app/backend/
RUN chmod +x /app/backend/cmd/start.sh

# Copy entrypoint script
COPY --chown=app:app ./scripts/docker-entrypoint.sh /app/scripts/docker-entrypoint.sh
RUN chmod +x /app/scripts/docker-entrypoint.sh

# Copy built frontend from builder
RUN rm -rf /app/backend/dist
COPY --from=builder --chown=app:app /app/dist ./backend/dist
COPY --from=builder --chown=app:app /app/public/favicon* ./backend/dist/
COPY --from=builder --chown=app:app /app/public/manifest.json ./backend/dist/
COPY --from=builder --chown=app:app /app/public/locales ./backend/dist/locales

# Copy ONLY production node_modules and package.json
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json /app/

# Create necessary directories
RUN mkdir -p /app/backend/db /app/backend/certs /app/backend/uploads

VOLUME ["/app/backend/db"]
VOLUME ["/app/backend/uploads"]

EXPOSE 3002

ENV NODE_ENV=production \
    DB_FILE="db/production.sqlite3" \
    PORT=3002 \
    TUDUDI_ALLOWED_ORIGINS="http://localhost:8080,http://localhost:3002,http://127.0.0.1:8080,http://127.0.0.1:3002" \
    TUDUDI_SESSION_SECRET="" \
    TUDUDI_USER_EMAIL="" \
    TUDUDI_USER_PASSWORD="" \
    DISABLE_TELEGRAM=false \
    DISABLE_SCHEDULER=false \
    TUDUDI_UPLOAD_PATH="/app/backend/uploads"

HEALTHCHECK --interval=60s --timeout=3s --start-period=10s --retries=2 \
    CMD curl -sf http://localhost:3002/api/health || exit 1

WORKDIR /app/backend
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
