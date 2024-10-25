# Stage 1: Build the React frontend
FROM node:16 AS frontend-builder

WORKDIR /app

# Copy and install frontend dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Build the frontend assets
RUN npm run build

# Stage 2: Build the Sinatra backend
FROM ruby:3.2.2-slim

# Install necessary packages
RUN apt-get update -qq && apt-get install -y \
    build-essential \
    libsqlite3-dev \
    openssl \
    libffi-dev \
    libpq-dev

WORKDIR /usr/src/app

# Copy and install backend dependencies
COPY Gemfile* ./
RUN bundle config set without 'development test' && bundle install

# Copy the backend code
COPY . .

# Remove any existing development databases
RUN rm -f db/development*

# Copy built frontend assets from the frontend builder stage
COPY --from=frontend-builder /app/public ./public

# Expose the application port
EXPOSE 9292

# Set environment variables
ENV RACK_ENV=production
ENV TUDUDI_INTERNAL_SSL_ENABLED=false

# Generate SSL certificates
RUN mkdir -p certs && \
    openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt \
    -days 365 -nodes -subj '/CN=localhost'

# Run database migrations and start the Puma server
CMD rake db:migrate && puma -C app/config/puma.rb
