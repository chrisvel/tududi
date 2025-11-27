###############
# BUILD STAGE #
###############
# Use Node.js Alpine for minimal build image
FROM node:22-alpine AS builder

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev \
    sqlite \
    bash

# Update npm to latest version
RUN npm install -g npm@11.6.4

WORKDIR /app

COPY package.json package-lock.json ./

# Install all dependencies (frontend and backend)
RUN npm install --no-audit --no-fund

# Copy source code
COPY . ./

# Build frontend
RUN NODE_ENV=production npm run frontend:build

# Run backend tests
# RUN npm run backend:test

# Cleanup
RUN npm cache clean --force && \
    rm -rf ~/.npm /tmp/*


####################
# Production stage #
####################
FROM node:22-alpine AS production

ENV APP_UID=1001
ENV APP_GID=1001

# Install minimal runtime dependencies
RUN apk add --no-cache \
    bash \
    sqlite \
    dumb-init \
    su-exec && \
    rm -rf /tmp/* /var/cache/apk/*

# Update npm to latest version
RUN npm install -g npm@11.6.4

# Create app user and group
RUN addgroup -g ${APP_GID} app && \
    adduser -D -u ${APP_UID} -G app app

# Set working directory
WORKDIR /app

# Copy backend
COPY --chown=app:app ./backend/ /app/backend/
RUN chmod +x /app/backend/cmd/start.sh

COPY --chown=app:app ./scripts/docker-entrypoint.sh /app/scripts/docker-entrypoint.sh
RUN chmod +x /app/scripts/docker-entrypoint.sh

# Copy package files first
COPY --chown=app:app package.json package-lock.json /app/

# Install production dependencies only
RUN npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force && \
    # Remove unnecessary files from node_modules to reduce size
    find /app/node_modules -type f \( \
        -name "*.md" -o \
        -name "*.ts" -o \
        -name "*.map" -o \
        -name "LICENSE*" -o \
        -name "CHANGELOG*" -o \
        -name "README*" -o \
        -name ".*.yml" -o \
        -name "*.txt" \
    \) -delete && \
    find /app/node_modules -type d \( \
        -name "test" -o \
        -name "tests" -o \
        -name "__tests__" -o \
        -name "docs" -o \
        -name "examples" -o \
        -name "example" -o \
        -name "coverage" -o \
        -name ".github" \
    \) -exec rm -rf {} + 2>/dev/null || true

# Copy frontend
RUN rm -rf /app/backend/dist
COPY --from=builder --chown=app:app /app/dist ./backend/dist
COPY --from=builder --chown=app:app /app/public/favicon* ./backend/dist/
COPY --from=builder --chown=app:app /app/public/manifest.json ./backend/dist/
COPY --from=builder --chown=app:app /app/public/locales ./backend/dist/locales

# Create necessary directories
RUN mkdir -p /app/backend/db /app/backend/certs /app/backend/uploads && \
    chown -R app:app /app/backend/db /app/backend/certs /app/backend/uploads

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
    TUDUDI_UPLOAD_PATH="/app/backend/uploads" \
    SWAGGER_ENABLED=false

HEALTHCHECK --interval=60s --timeout=3s --start-period=10s --retries=2 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/api/health || exit 1

WORKDIR /app/backend
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
