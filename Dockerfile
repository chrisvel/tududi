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

# Create non-root user for security
RUN useradd -m -U app && \
    chown -R app:app /usr/src/app

USER app

# Expose ports for both frontend (8080) and backend (9292)
EXPOSE 8080 9292

# Set production environment variables
ENV RACK_ENV=production \
    NODE_ENV=production \
    TUDUDI_INTERNAL_SSL_ENABLED=false \
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

# Add healthcheck for backend
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9292/api/health || exit 1

# Build production frontend assets
RUN npm run build

# Copy translation files to dist folder for production serving
RUN cp -r public/locales dist/

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Run database migrations\n\
bundle exec rake db:migrate\n\
\n\
# Create user if it does not exist\n\
if [ -n "$TUDUDI_USER_EMAIL" ] && [ -n "$TUDUDI_USER_PASSWORD" ]; then\n\
  echo "Creating user if it does not exist..."\n\
  echo "user = User.find_by(email: \"$TUDUDI_USER_EMAIL\") || User.create(email: \"$TUDUDI_USER_EMAIL\", password: \"$TUDUDI_USER_PASSWORD\"); puts \"User: #{user.email}\"" | bundle exec rake console\n\
fi\n\
\n\
# Start backend with both API and static file serving\n\
bundle exec puma -C app/config/puma.rb\n\
' > start.sh && chmod +x start.sh

# Run both services
CMD ["./start.sh"]