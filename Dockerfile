# Stage 1: Build the React frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY webpack.config.js ./
COPY babel.config.js ./
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./

# Install dependencies with npm ci for more reliable builds
RUN npm ci

# Copy only the frontend source code
COPY frontend/ frontend/
COPY public/ public/
COPY src/ src/

# Build the frontend assets
RUN npm run build

# Stage 2: Build the Sinatra backend
FROM ruby:3.2.2-slim AS backend

# Install necessary packages and clean up in one layer
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libsqlite3-dev \
    openssl \
    libffi-dev \
    libpq-dev \
    curl && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

WORKDIR /usr/src/app

# Copy Gemfile and install dependencies
COPY Gemfile* ./
RUN bundle config set --local deployment 'true' && \
    bundle config set --local without 'development test' && \
    bundle install --jobs 4 --retry 3

# Remove any existing development databases
RUN rm -f db/development*

# Copy only necessary backend files
COPY app/ app/
COPY config/ config/
COPY config.ru ./
COPY Rakefile ./
COPY app.rb ./
COPY db/migrate/ db/migrate/
COPY db/schema.rb db/schema.rb

# Copy built frontend assets from the frontend builder stage
COPY --from=frontend-builder /app/public ./public

# Create non-root user for security
RUN useradd -m -U app && \
    chown -R app:app /usr/src/app

USER app

# Expose the application port
EXPOSE 9292

# Set production environment variables
ENV RACK_ENV=production \
    TUDUDI_INTERNAL_SSL_ENABLED=false \
    TUDUDI_SESSION_SECRET_LENGTH=64 \
    TUDUDI_ALLOWED_ORIGINS="http://localhost:8080,http://localhost:9292,http://127.0.0.1:8080,http://127.0.0.1:9292,http://0.0.0.0:8080,http://0.0.0.0:9292" \
    LANG=C.UTF-8 \
    TZ=UTC

# Generate SSL certificates if needed
RUN mkdir -p certs && \
    if [ "$TUDUDI_INTERNAL_SSL_ENABLED" = "true" ]; then \
    openssl req -x509 -newkey rsa:4096 \
    -keyout certs/server.key -out certs/server.crt \
    -days 365 -nodes \
    -subj '/CN=localhost' \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"; \
    fi

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9292/api/health || exit 1

# Run database migrations and start the Puma server
CMD ["sh", "-c", "bundle exec rake db:migrate && bundle exec puma -C app/config/puma.rb"]
