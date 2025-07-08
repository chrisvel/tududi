###############
# BUILD STAGE #
###############
FROM node:20-alpine AS builder

RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    sqlite-dev

WORKDIR /app

COPY . ./

# Build frontend
RUN npm install --no-audit --no-fund
RUN NODE_ENV=production npm run build
# Install backend dependencies
RUN cd backend && npm install --no-audit --no-fund
# Run backend tests
RUN cd backend && DOCKER_BUILD=1 npm test
# Cleanup
RUN npm cache clean --force && \
    rm -rf ~/.npm /tmp/* && \
    apk del .build-deps

####################
# Production stage #
####################
FROM node:20-alpine AS production

# Set build-time and runtime UID/GID (default 1001)
ARG APP_UID=1001
ARG APP_GID=1001
ENV APP_UID=${APP_UID}
ENV APP_GID=${APP_GID}

RUN addgroup -g ${APP_GID} -S app && \
    adduser -S app -u ${APP_UID} -G app

RUN apk add --no-cache --virtual .runtime-deps \
    sqlite \
    openssl \
    curl \
    dumb-init && \
    rm -rf /var/cache/apk/* /tmp/* && \
    rm -rf /usr/share/man /usr/share/doc /usr/share/info

# Set working directory
WORKDIR /app

# Copy backend dependencies
COPY --from=builder --chown=app:app /app/backend/node_modules ./backend/node_modules
# Copy backend application
COPY --chown=app:app backend/app.js ./backend/
COPY --chown=app:app backend/package*.json ./backend/
COPY --chown=app:app backend/config/ ./backend/config/
COPY --chown=app:app backend/models/ ./backend/models/
COPY --chown=app:app backend/routes/ ./backend/routes/
COPY --chown=app:app backend/middleware/ ./backend/middleware/
COPY --chown=app:app backend/services/ ./backend/services/
COPY --chown=app:app backend/scripts/ ./backend/scripts/

# Copy frontend
COPY --from=builder --chown=app:app /app/dist ./backend/dist
COPY --from=builder --chown=app:app /app/public/locales ./backend/dist/locales

# Create ultra-minimal startup script (before switching to non-root user)
RUN printf '#!/bin/sh\nset -e\ncd backend\n# Check and create directories with proper permissions\nif [ ! -d "db" ]; then\n  mkdir -p db\nfi\nif [ ! -w "db" ]; then\n  if [ "$(id -u)" = "0" ]; then\n    echo "⚠️  Attempting to fix permissions for /app/backend/db as root..."\n    chown -R $APP_UID:$APP_GID db || true\n    chmod -R 770 db || true\n    if [ ! -w "db" ]; then\n      echo "❌ ERROR: Database directory /app/backend/db is not writable by user $APP_UID:$APP_GID after chown/chmod"\n      exit 1\n    fi\n  else\n    echo "❌ ERROR: Database directory /app/backend/db is not writable by user $(id -u):$(id -g)"\n    echo "ℹ️  If using Docker volumes, ensure the host directory has proper ownership or run the container as root for automatic fix."\n    exit 1\n  fi\nfi\nmkdir -p certs\nDB_FILE="db/production.sqlite3"\n[ "$NODE_ENV" = "development" ] && DB_FILE="db/development.sqlite3"\nif [ ! -f "$DB_FILE" ]; then\n  node -e "require(\\"./models\\").sequelize.sync({force:true}).then(()=>{console.log(\\"✅ DB ready\\");process.exit(0)}).catch(e=>{console.error(\\"❌\\",e.message);process.exit(1)})"\nelse\n  node -e "require(\\"./models\\").sequelize.authenticate().then(()=>{console.log(\\"✅ DB OK\\");process.exit(0)}).catch(e=>{console.error(\\"❌\\",e.message);process.exit(1)})"\nfi\nif [ -n "$TUDUDI_USER_EMAIL" ]&&[ -n "$TUDUDI_USER_PASSWORD" ]; then\n  node -e "const{User}=require(\\"./models\\");const bcrypt=require(\\"bcrypt\\");(async()=>{try{const[u,c]=await User.findOrCreate({where:{email:process.env.TUDUDI_USER_EMAIL},defaults:{email:process.env.TUDUDI_USER_EMAIL,password_digest:await bcrypt.hash(process.env.TUDUDI_USER_PASSWORD,10)}});console.log(c?\\"✅ User created\\":\\"ℹ️ User exists\\");process.exit(0)}catch(e){console.error(\\"❌\\",e.message);process.exit(1)}})();"||exit 1\nfi\n[ "$TUDUDI_INTERNAL_SSL_ENABLED" = "true" ]&&[ ! -f "certs/server.crt" ]&&openssl req -x509 -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/CN=localhost" 2>/dev/null||true\nexec node app.js\n' > start.sh && chmod +x start.sh

# Create necessary directories
RUN mkdir -p ./backend/db ./backend/certs && \
    chown -R app:app ./backend/db ./backend/certs ./start.sh

# Cleanup
RUN apk del --no-cache .runtime-deps sqlite openssl curl && \
    apk add --no-cache sqlite-libs openssl curl dumb-init && \
    rm -rf /usr/local/lib/node_modules/npm/docs /usr/local/lib/node_modules/npm/man && \
    rm -rf /root/.npm /tmp/* /var/tmp/* /var/cache/apk/*

VOLUME ["/app/backend/db"]

USER app

EXPOSE 3002

ENV NODE_ENV=production \
    PORT=3002 \
    TUDUDI_INTERNAL_SSL_ENABLED=false \
    TUDUDI_ALLOWED_ORIGINS="http://localhost:8080,http://localhost:3002,http://127.0.0.1:8080,http://127.0.0.1:3002" \
    TUDUDI_SESSION_SECRET="" \
    TUDUDI_USER_EMAIL="" \
    TUDUDI_USER_PASSWORD="" \
    DISABLE_TELEGRAM=false \
    DISABLE_SCHEDULER=false

# Docker healthcheck
HEALTHCHECK --interval=60s --timeout=3s --start-period=10s --retries=2 \
    CMD curl -sf http://localhost:3002/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]
