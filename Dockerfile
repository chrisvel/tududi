###############
# BUILD STAGE #
###############
FROM node:22-alpine AS builder

RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    sqlite-dev

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

# Cleanup
RUN npm cache clean --force && \
    rm -rf ~/.npm /tmp/* && \
    apk del .build-deps


####################
# Production stage #
####################
FROM node:22-alpine AS production

ENV APP_UID=1001
ENV APP_GID=1001

RUN addgroup -g ${APP_GID} -S app && \
    adduser -S app -u ${APP_UID} -G app

RUN apk add --no-cache --virtual .runtime-deps \
    sqlite \
    openssl \
    curl \
    procps-ng \
    dumb-init \
    su-exec && \
    rm -rf /var/cache/apk/* /tmp/* && \
    rm -rf /usr/share/man /usr/share/doc /usr/share/info

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
COPY --from=builder --chown=app:app /app/public/locales ./backend/dist/locales
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json /app/

# Create necessary directories
RUN mkdir -p /app/backend/db /app/backend/certs /app/backend/uploads

# Cleanup
RUN apk del --no-cache .runtime-deps sqlite openssl curl && \
    apk add --no-cache sqlite-libs openssl curl dumb-init su-exec && \
    rm -rf /usr/local/lib/node_modules/npm/docs /usr/local/lib/node_modules/npm/man && \
    rm -rf /root/.npm /tmp/* /var/tmp/* /var/cache/apk/*

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
