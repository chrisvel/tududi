#!/usr/bin/env node

const path = require('path');
const { seedDatabase } = require('../seeders/dev-seeder');
const { getConfig } = require('../config/config');
const config = getConfig();

console.log('🌱 Starting development data seeding...');
console.log(`📁 Database: ${config.db.database}`);
console.log(`🌍 Environment: ${config.environment}`);

seedDatabase();
