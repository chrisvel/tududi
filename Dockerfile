# ================================
# Build Stage - Node.js frontend
# ================================
FROM node:20-slim AS frontend-builder

WORKDIR /app

# Copy Node.js dependency files
COPY package*.json ./
COPY webpack.config.js ./
COPY babel.config.js ./
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY eslint.config.mjs ./

# Install Node.js dependencies (including dev dependencies for build)
RUN npm ci

# Copy frontend source files
COPY frontend/ frontend/
COPY public/ public/
COPY src/ src/
COPY index.html ./

# Build production frontend assets
RUN npm run build

# Copy translation files to dist folder for production serving
RUN cp -r public/locales dist/

# ================================
# Build Stage - Ruby dependencies
# ================================
FROM ruby:3.2.2-slim AS ruby-builder

# Install build dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libsqlite3-dev \
    libffi-dev \
    libpq-dev && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

WORKDIR /app

# Copy Ruby dependency files
COPY Gemfile* ./

# Install Ruby dependencies
RUN bundle config set --local without 'development test' && \
    bundle install --jobs 4 --retry 3

# ================================
# Production Stage
# ================================
FROM ruby:3.2.2-slim AS production

# Install only runtime dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    openssl \
    libffi8 \
    libpq5 \
    curl \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

WORKDIR /usr/src/app

# Copy Ruby gems from builder stage
COPY --from=ruby-builder /usr/local/bundle /usr/local/bundle

# Copy Gemfile for bundle to work properly
COPY Gemfile* ./

# Configure bundle for production use - don't set path, use system gems
RUN bundle config set --local without 'development test'

# Copy built frontend assets from frontend builder
COPY --from=frontend-builder /app/dist ./dist

# Copy application files
COPY app/ app/
COPY config/ config/
COPY config.ru ./
COPY Rakefile ./
COPY app.rb ./
COPY db/migrate/ db/migrate/
COPY db/schema.rb db/schema.rb
COPY public/ public/

# Copy additional necessary files
COPY console.rb ./
COPY translation.json ./

# Copy and set permissions for entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Remove any existing development databases
RUN rm -f db/development*

# Create user for running the application (do this early)
RUN groupadd -g 1000 appuser && \
    useradd -r -u 1000 -g appuser appuser

# Create directories that need write access and make them owned by appuser
# This ensures the application user can write to them
RUN mkdir -p /usr/src/app/tududi_db \
             /usr/src/app/certs \
             /usr/src/app/tmp \
             /usr/src/app/log && \
    # Set standard permissions for application files
    chmod -R 755 /usr/src/app && \
    # Change ownership of writable directories to appuser
    chown -R appuser:appuser /usr/src/app/tududi_db \
                             /usr/src/app/certs \
                             /usr/src/app/tmp \
                             /usr/src/app/log \
                             /usr/src/app/db && \
    # Make directories group-writable for Kubernetes fsGroup compatibility
    chmod -R g+w /usr/src/app/tududi_db \
                 /usr/src/app/certs \
                 /usr/src/app/tmp \
                 /usr/src/app/log \
                 /usr/src/app/db && \
    # Ensure specific files are executable
    chmod +x /usr/src/app/config.ru

# Set environment variables
ENV RACK_ENV=production \
    NODE_ENV=production \
    TUDUDI_INTERNAL_SSL_ENABLED=false \
    TUDUDI_ALLOWED_ORIGINS="http://localhost:8080,http://localhost:9292,http://127.0.0.1:8080,http://127.0.0.1:9292,http://0.0.0.0:8080,http://0.0.0.0:9292" \
    LANG=C.UTF-8 \
    TZ=UTC

# Expose ports for both frontend (8080) and backend (9292)
EXPOSE 8080 9292

# Add healthcheck for backend
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9292/api/health || exit 1

# Use non-root user with UID 1000
USER 1000:1000

# Run the application
CMD ["./entrypoint.sh"]
