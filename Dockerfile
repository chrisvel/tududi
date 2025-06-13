# Use a base image that supports both Node.js and Ruby
FROM ruby:3.2.2-slim

# Install Node.js and necessary packages
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libsqlite3-dev \
    openssl \
    libffi-dev \
    libpq-dev \
    curl \
    gnupg2 \
    ca-certificates && \
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

WORKDIR /usr/src/app

# Install Ruby dependencies first
COPY Gemfile* ./
RUN bundle config set --local deployment 'true' && \
    bundle config set --local without 'development test' && \
    bundle install --jobs 4 --retry 3

# Install Node.js dependencies
COPY package*.json ./
COPY webpack.config.js ./
COPY babel.config.js ./
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
RUN npm ci

# Remove any existing development databases
RUN rm -f db/development*

# Copy application files
COPY app/ app/
COPY config/ config/
COPY config.ru ./
COPY Rakefile ./
COPY app.rb ./
COPY db/migrate/ db/migrate/
COPY db/schema.rb db/schema.rb
COPY frontend/ frontend/
COPY public/ public/
COPY src/ src/

# Build production frontend assets (do this as root before setting permissions)
RUN npm run build

# Copy translation files to dist folder for production serving
RUN cp -r public/locales dist/

# Create directories that need write access with world-writable permissions
# This allows any UID/GID to write to these directories
RUN mkdir -p /usr/src/app/tududi_db \
             /usr/src/app/certs \
             /usr/src/app/tmp \
             /usr/src/app/log && \
    # Set read permissions for application files FIRST
    chmod -R 755 /usr/src/app && \
    # THEN set world-writable permissions for specific directories (this overrides the 755)
    chmod 777 /usr/src/app/tududi_db \
              /usr/src/app/certs \
              /usr/src/app/tmp \
              /usr/src/app/log && \
    # Make db directory writable for schema updates
    chmod 777 /usr/src/app/db && \
    # Make schema.rb writable for Rails schema updates
    chmod 666 /usr/src/app/db/schema.rb && \
    # Ensure specific files are executable
    chmod +x /usr/src/app/config.ru

# Copy and set permissions for entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

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

# Don't specify USER - let Kubernetes/OpenShift set it via securityContext
# The application will run with whatever UID/GID is assigned by the platform

# Run the application
CMD ["./entrypoint.sh"]
