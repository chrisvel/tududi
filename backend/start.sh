#!/bin/bash
# Start script for Express backend

echo "Starting Express backend..."
echo "Make sure to set environment variables if needed:"
echo "  TUDUDI_SESSION_SECRET=your_secret_here"
echo "  TUDUDI_USER_EMAIL=your_email@example.com"
echo "  TUDUDI_USER_PASSWORD=your_password"
echo ""

NODE_ENV=development PORT=3002 npm start
