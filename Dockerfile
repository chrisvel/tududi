###############
# BUILD STAGE #
###############
# Use Playwright image with browsers and deps preinstalled for running E2E tests
FROM mcr.microsoft.com/playwright:v1.54.2-jammy AS builder

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    pkg-config \
    libsqlite3-dev \
    sqlite3 \
    bash \
    curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./

# Install all dependencies (frontend and backend)
RUN npm install --no-audit --no-fund

# Copy source code
COPY . ./

# Build frontend
RUN NODE_ENV=production npm run frontend:build

# Run backend tests
RUN npm run backend:test

# Uncomment to run E2E tests (browsers already present in this base image)
#ENV CI=1
#RUN npm run test:ui

# Cleanup
RUN npm cache clean --force && \
    rm -rf ~/.npm /tmp/*


####################
# Production stage #
####################
FROM ubuntu:22.04 AS production

ENV APP_UID=1001
ENV APP_GID=1001

# Install Node.js 22 and runtime dependencies
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    sqlite3 \
    openssl \
    procps \
    dumb-init \
    bash \
    gosu && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    rm -rf /usr/share/man /usr/share/doc /usr/share/info

# Create app user and group
RUN groupadd -g ${APP_GID} app && \
    useradd -m -u ${APP_UID} -g app app

# Set working directory
WORKDIR /app

# Copy backend
COPY --chown=app:app ./backend/ /app/backend/
RUN chmod +x /app/backend/cmd/start.sh

COPY --chown=app:app ./scripts/docker-entrypoint.sh /app/scripts/docker-entrypoint.sh
RUN chmod +x /app/scripts/docker-entrypoint.sh

# Copy frontend
RUN rm -rf /app/backend/dist
COPY --from=builder --chown=app:app /app/dist ./backend/dist
COPY --from=builder --chown=app:app /app/public/favicon* ./backend/dist/
COPY --from=builder --chown=app:app /app/public/manifest.json ./backend/dist/
COPY --from=builder --chown=app:app /app/public/locales ./backend/dist/locales
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json /app/

# Create necessary directories
RUN mkdir -p /app/backend/db /app/backend/certs /app/backend/uploads

# Cleanup
RUN rm -rf /usr/local/lib/node_modules/npm/docs /usr/local/lib/node_modules/npm/man && \
    rm -rf /root/.npm /tmp/* /var/tmp/*

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
