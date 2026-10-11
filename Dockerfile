###############
# BUILD STAGE #
###############
# Runs on the build host's own architecture: only the compiled frontend and
# static assets leave this stage, and they do not depend on the target CPU.
# Building them under QEMU for arm64 made the full npm install time out.
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

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
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm install --no-audit --no-fund

# Copy source code
COPY . ./

# Build frontend
RUN NODE_ENV=production npm run frontend:build

# Build installed plugins.
#
# The production stage has neither a toolchain nor dev dependencies, and a
# plugin whose entry point is missing is reported by the plugin manager as
# broken rather than loaded - so shipping one unbuilt would look like a broken
# install. node_modules is dropped afterwards: the bundle is the artifact.
RUN npm run plugins:build && \
    rm -rf plugins/*/node_modules

# Run backend tests
# RUN npm run backend:test

# Cleanup
RUN npm cache clean --force && \
    rm -rf ~/.npm /tmp/*


####################
# Production stage #
####################
FROM node:22-alpine AS production

# service: Kamal (the hosted deploy) refuses images without it.
# source: links the ghcr.io package to this repository.
LABEL service="tududi" \
      org.opencontainers.image.source="https://github.com/chrisvel/tududi"

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

# Install production dependencies only. A failed install must fail the
# build: only the size cleanup below is allowed to fail.
RUN npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force && \
    ln -s /app/node_modules /app/backend/node_modules && \
    # Remove unnecessary files from node_modules to reduce size
    { find /app/node_modules -type f \( \
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
    \) -exec rm -rf {} + 2>/dev/null || true; } && \
    cd /app/backend && \
    node -e "require('sequelize'); require('sqlite3'); require('express')"

# Copy frontend
RUN rm -rf /app/backend/dist
COPY --from=builder --chown=app:app /app/dist ./backend/dist
COPY --from=builder --chown=app:app /app/public/favicon* ./backend/dist/
COPY --from=builder --chown=app:app /app/public/manifest.json ./backend/dist/
COPY --from=builder --chown=app:app /app/public/locales ./backend/dist/locales

# Plugins that ship with the app, already built.
#
# They go to `plugins-bundled` rather than straight into the plugins root so
# that the root can be a volume without them disappearing behind it: a mount
# replaces whatever the image put at that path. The entrypoint copies this set
# into the root the first time the root is empty, which is what a first start
# looks like - with or without a volume mounted there.
COPY --from=builder --chown=app:app /app/plugins /app/plugins-bundled

# The plugins root is where an operator installs from the app itself, so it has
# to exist and be writable by the user the server runs as. Dropping a directory
# in by hand still works, and is unchanged.
RUN mkdir -p /app/plugins && chown app:app /app/plugins

# Create necessary directories
RUN mkdir -p /app/db /app/backend/certs /app/uploads /app/backups && \
    chown -R app:app /app/db /app/backend/certs /app/uploads /app/backups

VOLUME ["/app/db"]
VOLUME ["/app/uploads"]
VOLUME ["/app/backups"]
# A plugin installed from the UI is state, not build output: without a volume
# here it would be gone at the next 'docker compose up'.
VOLUME ["/app/plugins"]

EXPOSE 3002

ENV NODE_ENV=production \
    DB_FILE="/app/db/production.sqlite3" \
    PORT=3002 \
    TUDUDI_ALLOWED_ORIGINS="http://localhost:8080,http://localhost:3002,http://127.0.0.1:8080,http://127.0.0.1:3002" \
    TUDUDI_SESSION_SECRET="" \
    TUDUDI_USER_EMAIL="" \
    TUDUDI_USER_PASSWORD="" \
    TUDUDI_TRUST_PROXY=false \
    DISABLE_TELEGRAM=false \
    DISABLE_SCHEDULER=false \
    TUDUDI_UPLOAD_PATH="/app/uploads" \
    TUDUDI_BACKUP_PATH="/app/backups" \
    TUDUDI_PLUGINS_DIR="/app/plugins" \
    SWAGGER_ENABLED=false

HEALTHCHECK --interval=60s --timeout=3s --start-period=10s --retries=2 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:3002/api/health"]

WORKDIR /app/backend
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
