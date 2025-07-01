#!/usr/bin/env node

const path = require('path');
const { seedDatabase } = require('../seeders/dev-seeder');

// Set up the environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Ensure we're using the correct database path
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `sqlite:///${path.join(__dirname, '../db/development.sqlite3')}`;
}

console.log('🌱 Starting development data seeding...');
console.log(`📁 Database: ${process.env.DATABASE_URL}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);

seedDatabase();
