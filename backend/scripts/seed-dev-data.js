#!/usr/bin/env node

const path = require('path');
const { seedDatabase } = require('../seeders/dev-seeder');
const config = require('../config/config');

console.log('🌱 Starting development data seeding...');
console.log(`📁 Database: ${config.dbFile}`);
console.log(`🌍 Environment: ${config.environment}`);

seedDatabase();
