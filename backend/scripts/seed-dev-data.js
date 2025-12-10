#!/usr/bin/env node

const { seedDatabase } = require('../seeders');
const { getConfig } = require('../config/config');
const config = getConfig();

console.log('🌱 Starting development data seeding...');
console.log(`📁 Database: ${config.dbFile}`);
console.log(`🌍 Environment: ${config.environment}`);

(async () => {
    try {
        await seedDatabase();
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        process.exit(1);
    }
})();
