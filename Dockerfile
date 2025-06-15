# Use Node.js 20 LTS as base image
FROM node:20-slim

# Install system dependencies including SQLite
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libsqlite3-dev \
    sqlite3 \
    openssl \
    curl \
    ca-certificates \
    python3 \
    make \
    g++ && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

WORKDIR /usr/src/app

# Install Node.js dependencies first (backend)
COPY backend-express/package*.json ./backend-express/
RUN cd backend-express && npm ci --only=production

# Install frontend dependencies
COPY package*.json ./
COPY webpack.config.js ./
COPY babel.config.js ./
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
RUN npm ci

# Copy backend application files
COPY backend-express/ backend-express/
COPY frontend/ frontend/
COPY public/ public/
COPY src/ src/

# Create non-root user for security
RUN useradd -m -U app && \
    chown -R app:app /usr/src/app

USER app

# Expose ports for both frontend (8080) and backend (3002)
EXPOSE 8080 3002

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3002 \
    TUDUDI_INTERNAL_SSL_ENABLED=false \
    TUDUDI_ALLOWED_ORIGINS="http://localhost:8080,http://localhost:3002,http://127.0.0.1:8080,http://127.0.0.1:3002,http://0.0.0.0:8080,http://0.0.0.0:3002" \
    TUDUDI_SESSION_SECRET="" \
    TUDUDI_USER_EMAIL="" \
    TUDUDI_USER_PASSWORD="" \
    DISABLE_TELEGRAM=false \
    DISABLE_SCHEDULER=false \
    LANG=C.UTF-8 \
    TZ=UTC

# Generate SSL certificates if needed
RUN mkdir -p backend-express/certs && \
    if [ "$TUDUDI_INTERNAL_SSL_ENABLED" = "true" ]; then \
    openssl req -x509 -newkey rsa:4096 \
    -keyout backend-express/certs/server.key -out backend-express/certs/server.crt \
    -days 365 -nodes \
    -subj '/CN=localhost' \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"; \
    fi

# Add healthcheck for Express backend
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/api/health || exit 1

# Build production frontend assets
RUN npm run build

# Copy translation files to dist folder for production serving
RUN cp -r public/locales dist/

# Create startup script for Express backend
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Navigate to backend directory\n\
cd backend-express\n\
\n\
# Create database directory if it does not exist\n\
mkdir -p db\n\
\n\
# Set database file based on environment\n\
DB_FILE="db/production.sqlite3"\n\
if [ "$NODE_ENV" = "development" ]; then\n\
  DB_FILE="db/development.sqlite3"\n\
fi\n\
\n\
# Initialize database if it does not exist\n\
if [ ! -f "$DB_FILE" ]; then\n\
  echo "Initializing database: $DB_FILE"\n\
  if ! node -e "require(\"./models\").sequelize.sync({ force: true }).then(() => { console.log(\"Database synchronized\"); process.exit(0); }).catch(err => { console.error(\"Database sync error:\", err); process.exit(1); })"; then\n\
    echo "ERROR: Failed to initialize database"\n\
    exit 1\n\
  fi\n\
else\n\
  echo "Database already exists: $DB_FILE"\n\
  # Test database connection\n\
  if ! node -e "require(\"./models\").sequelize.authenticate().then(() => { console.log(\"Database connection verified\"); process.exit(0); }).catch(err => { console.error(\"Database connection failed:\", err); process.exit(1); })"; then\n\
    echo "ERROR: Cannot connect to database"\n\
    exit 1\n\
  fi\n\
fi\n\
\n\
# Create user if it does not exist and environment variables are set\n\
if [ -n "$TUDUDI_USER_EMAIL" ] && [ -n "$TUDUDI_USER_PASSWORD" ]; then\n\
  echo "Creating user if it does not exist..."\n\
  if ! node -e "\n\
    const { User } = require(\"./models\");\n\
    const bcrypt = require(\"bcrypt\");\n\
    (async () => {\n\
      try {\n\
        const [user, created] = await User.findOrCreate({\n\
          where: { email: process.env.TUDUDI_USER_EMAIL },\n\
          defaults: {\n\
            email: process.env.TUDUDI_USER_EMAIL,\n\
            password: await bcrypt.hash(process.env.TUDUDI_USER_PASSWORD, 10)\n\
          }\n\
        });\n\
        console.log(created ? \"User created:\" : \"User exists:\", user.email);\n\
        process.exit(0);\n\
      } catch (error) {\n\
        console.error(\"Error creating user:\", error);\n\
        process.exit(1);\n\
      }\n\
    })();\n\
  "; then\n\
    echo "ERROR: Failed to create user"\n\
    exit 1\n\
  fi\n\
else\n\
  echo "No user credentials provided, skipping user creation"\n\
fi\n\
\n\
# Start Express backend\n\
node app.js\n\
' > start.sh && chmod +x start.sh

# Run Express backend
CMD ["./start.sh"]