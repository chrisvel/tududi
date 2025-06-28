# ============================================================================
# Ultra-optimized multi-stage build for minimal rootless Docker image
# ============================================================================

# Stage 1: Frontend Build Environment (optimized)
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend package files
COPY package*.json ./
COPY webpack.config.js babel.config.js tsconfig.json postcss.config.js tailwind.config.js ./

# Install frontend dependencies (including dev deps for build)
RUN npm install --ignore-scripts --no-audit --no-fund && \
    npm cache clean --force && \
    rm -rf ~/.npm

# Copy frontend source code
COPY frontend/ frontend/
COPY public/ public/

# Build frontend assets with optimizations
RUN NODE_ENV=production npm run build && \
    # Remove source maps and dev artifacts
    find dist -name "*.map" -delete && \
    find dist -name "*.dev.*" -delete && \
    # Compress built assets
    find dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" \) -exec gzip -9 -k {} \;

# Stage 2: Backend Dependencies (ultra-minimal)
FROM node:20-alpine AS backend-deps

WORKDIR /app

# Install build dependencies temporarily for native modules
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    sqlite-dev

# Install only runtime dependencies for backend
COPY backend/package*.json ./
RUN npm install --production --no-audit --no-fund && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/* && \
    # Remove build dependencies after install
    apk del .build-deps && \
    # Remove unnecessary files from node_modules
    find node_modules -name "*.md" -delete && \
    find node_modules -name "*.txt" -delete && \
    find node_modules -name "LICENSE*" -delete && \
    find node_modules -name "CHANGELOG*" -delete && \
    find node_modules -name "README*" -delete && \
    find node_modules -name ".github" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "docs" -type d ! -path "*/googleapis/*" -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true

# Stage 3: Test Stage (run tests before production)
FROM node:20-alpine AS test

WORKDIR /app

# Install build dependencies for testing
RUN apk add --no-cache --virtual .test-deps \
    python3 \
    make \
    g++ \
    sqlite-dev

# Copy backend package files and install all dependencies (including dev)
COPY backend/package*.json ./backend/
RUN cd backend && \
    # Retry npm install with exponential backoff for network issues
    for i in 1 2 3; do \
        npm install --no-audit --no-fund && break || \
        (echo "npm install failed, attempt $i/3, retrying in $((i*5)) seconds..." && sleep $((i*5))); \
    done

# Copy backend source code including tests
COPY backend/ ./backend/

# Run tests
RUN cd backend && npm test

# Create test completion marker to ensure tests passed
RUN echo "Tests passed successfully" > /app/test-success.marker

# Stage 4: Final Production Image (minimal base)
FROM node:20-alpine AS production

# Copy test success marker to ensure tests passed before production build
COPY --from=test /app/test-success.marker /tmp/test-success.marker

# Set build-time and runtime UID/GID (default 1001)
ARG APP_UID=1001
ARG APP_GID=1001
ENV APP_UID=${APP_UID}
ENV APP_GID=${APP_GID}

# Create non-root user/group with configurable UID/GID
RUN addgroup -g ${APP_GID} -S app && \
    adduser -S app -u ${APP_UID} -G app

# Install minimal runtime dependencies with size optimization
RUN apk add --no-cache --virtual .runtime-deps \
    sqlite \
    openssl \
    curl \
    dumb-init && \
    # Clean up package cache immediately
    rm -rf /var/cache/apk/* /tmp/* && \
    # Remove unnecessary files
    rm -rf /usr/share/man /usr/share/doc /usr/share/info

# Set working directory
WORKDIR /app

# Copy backend dependencies from deps stage (optimized)
COPY --from=backend-deps --chown=app:app /app/node_modules ./backend/node_modules

# Copy backend application code (exclude unnecessary files)
COPY --chown=app:app backend/app.js ./backend/
COPY --chown=app:app backend/package*.json ./backend/
COPY --chown=app:app backend/config/ ./backend/config/
COPY --chown=app:app backend/models/ ./backend/models/
COPY --chown=app:app backend/routes/ ./backend/routes/
COPY --chown=app:app backend/middleware/ ./backend/middleware/
COPY --chown=app:app backend/services/ ./backend/services/

# Copy minimal built frontend assets from builder stage
COPY --from=frontend-builder --chown=app:app /app/dist ./backend/dist
COPY --from=frontend-builder --chown=app:app /app/public/locales ./backend/dist/locales

# Create ultra-minimal startup script (before switching to non-root user)
RUN printf '#!/bin/sh\nset -e\ncd backend\n# Check and create directories with proper permissions\nif [ ! -d "db" ]; then\n  mkdir -p db\nfi\nif [ ! -w "db" ]; then\n  if [ "$(id -u)" = "0" ]; then\n    echo "⚠️  Attempting to fix permissions for /app/backend/db as root..."\n    chown -R $APP_UID:$APP_GID db || true\n    chmod -R 770 db || true\n    if [ ! -w "db" ]; then\n      echo "❌ ERROR: Database directory /app/backend/db is not writable by user $APP_UID:$APP_GID after chown/chmod"\n      exit 1\n    fi\n  else\n    echo "❌ ERROR: Database directory /app/backend/db is not writable by user $(id -u):$(id -g)"\n    echo "ℹ️  If using Docker volumes, ensure the host directory has proper ownership or run the container as root for automatic fix."\n    exit 1\n  fi\nfi\nmkdir -p certs\nDB_FILE="db/production.sqlite3"\n[ "$NODE_ENV" = "development" ] && DB_FILE="db/development.sqlite3"\nif [ ! -f "$DB_FILE" ]; then\n  node -e "require(\\"./models\\").sequelize.sync({force:true}).then(()=>{console.log(\\"✅ DB ready\\");process.exit(0)}).catch(e=>{console.error(\\"❌\\",e.message);process.exit(1)})"\nelse\n  node -e "require(\\"./models\\").sequelize.authenticate().then(()=>{console.log(\\"✅ DB OK\\");process.exit(0)}).catch(e=>{console.error(\\"❌\\",e.message);process.exit(1)})"\nfi\nif [ -n "$TUDUDI_USER_EMAIL" ]&&[ -n "$TUDUDI_USER_PASSWORD" ]; then\n  node -e "const{User}=require(\\"./models\\");const bcrypt=require(\\"bcrypt\\");(async()=>{try{const[u,c]=await User.findOrCreate({where:{email:process.env.TUDUDI_USER_EMAIL},defaults:{email:process.env.TUDUDI_USER_EMAIL,password_digest:await bcrypt.hash(process.env.TUDUDI_USER_PASSWORD,10)}});console.log(c?\\"✅ User created\\":\\"ℹ️ User exists\\");process.exit(0)}catch(e){console.error(\\"❌\\",e.message);process.exit(1)}})();"||exit 1\nfi\n[ "$TUDUDI_INTERNAL_SSL_ENABLED" = "true" ]&&[ ! -f "certs/server.crt" ]&&openssl req -x509 -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/CN=localhost" 2>/dev/null||true\nexec node app.js\n' > start.sh && chmod +x start.sh

# Create necessary directories and final cleanup
RUN mkdir -p ./backend/db ./backend/certs && \
    chown -R app:app ./backend/db ./backend/certs ./start.sh && \
    # Final size optimization - remove Node.js build tools and cache
    apk del --no-cache .runtime-deps sqlite openssl curl && \
    apk add --no-cache sqlite-libs openssl curl dumb-init && \
    rm -rf /usr/local/lib/node_modules/npm/docs /usr/local/lib/node_modules/npm/man && \
    rm -rf /root/.npm /tmp/* /var/tmp/* /var/cache/apk/*

# Declare volume for database persistence
VOLUME ["/app/backend/db"]

# Switch to non-root user (can be overridden at runtime)
USER app

# Expose port
EXPOSE 3002

# Set optimized production environment variables
ENV NODE_ENV=production \
    PORT=3002 \
    TUDUDI_INTERNAL_SSL_ENABLED=false \
    TUDUDI_ALLOWED_ORIGINS="http://localhost:8080,http://localhost:3002,http://127.0.0.1:8080,http://127.0.0.1:3002" \
    TUDUDI_SESSION_SECRET="" \
    TUDUDI_USER_EMAIL="" \
    TUDUDI_USER_PASSWORD="" \
    DISABLE_TELEGRAM=false \
    DISABLE_SCHEDULER=false

# Minimal healthcheck
HEALTHCHECK --interval=60s --timeout=3s --start-period=10s --retries=2 \
    CMD curl -sf http://localhost:3002/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]