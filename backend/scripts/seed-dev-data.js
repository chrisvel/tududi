#!/usr/bin/env node

const path = require('path');
const { seedDatabase } = require('../seeders/dev-seeder');
const { setConfig, getConfig } = require('../config/config');
const config = getConfig();

console.log('🌱 Starting development data seeding...');
console.log(`📁 Database: ${config.dbFile}`);
console.log(`🌍 Environment: ${config.environment}`);

seedDatabase();
