#!/usr/bin/env node

/**
 * Database Status Script
 * Shows database connection status and basic information
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');

async function checkDatabaseStatus() {
    try {
        console.log('🔍 Checking database status...\n');

        console.log('📂 Database Configuration:');
        console.log(`   URI: ${config.mongodb_uri}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

        console.log('\n🔌 Testing database connection...');
        await mongoose.connect(config.mongodb_uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Database connection successful\n');

        // Get collection information
        console.log('📊 Collection Statistics:');
        const collections = await mongoose.connection.db.collections();

        for (const collection of collections) {
            const count = await collection.countDocuments();
            console.log(`   ${collection.collectionName}: ${count} documents`);
        }

        console.log('\n✅ Database status check completed');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Database connection failed:', error.message);
        process.exit(1);
    }
}

checkDatabaseStatus();
