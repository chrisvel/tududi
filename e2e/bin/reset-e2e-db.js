#!/usr/bin/env node
// Drops and recreates the e2e database so every run starts empty.
// Usage: node e2e/bin/reset-e2e-db.js [--drop-only]

const { Client } = require('pg');

const url = new URL(process.env.DATABASE_URL);
const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (!/^[A-Za-z0-9_]+$/.test(name)) {
    console.error(`Refusing to reset database with name '${name}'`);
    process.exit(1);
}

async function main() {
    const admin = new URL(url);
    admin.pathname = '/postgres';
    const client = new Client({ connectionString: admin.toString() });
    await client.connect();
    try {
        await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
        if (!process.argv.includes('--drop-only')) {
            await client.query(`CREATE DATABASE "${name}"`);
        }
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(`Could not reset the e2e database: ${error.message}`);
    process.exit(1);
});
