#!/bin/bash
# Start script for local development

echo ""
echo "============================================="
echo "Starting Express backend..."
echo "If you want to create/change a user,"
echo "use these environment variables:"
echo "  TUDUDI_USER_EMAIL=your_email@example.com"
echo "  TUDUDI_USER_PASSWORD=your_password"
echo "============================================="
echo ""

NODE_ENV=development PORT=3002 DB_FILE=db/development.sqlite3 ./cmd/start.sh
