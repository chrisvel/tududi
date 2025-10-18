#!/usr/bin/env node
/**
 * Simple script to populate missing UIDs for inbox items using sqlite3 directly
 * Usage: node backend/scripts/fix-inbox-uids.js [database_path]
 */

const sqlite3 = require('sqlite3').verbose();
const { uid } = require('../utils/uid');

const dbPath = process.argv[2] || 'backend/db/development.sqlite3';

console.log(`\nConnecting to database: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
});

function getItemsWithoutUID() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT id, content FROM inbox_items WHERE uid IS NULL OR uid = ""',
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

function updateItemUID(id, newUid) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE inbox_items SET uid = ? WHERE id = ?',
            [newUid, id],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

async function fixInboxItemUIDs() {
    try {
        console.log('Checking for inbox items without UIDs...\n');

        const items = await getItemsWithoutUID();

        console.log(`Found ${items.length} inbox item(s) without UIDs\n`);

        if (items.length === 0) {
            console.log('✓ All inbox items have UIDs!');
            db.close();
            return;
        }

        console.log('Items to fix:');
        items.forEach((item) => {
            const preview = item.content.substring(0, 50);
            console.log(`  - ID: ${item.id}, Content: ${preview}${item.content.length > 50 ? '...' : ''}`);
        });

        console.log('\nGenerating and assigning UIDs...\n');

        for (const item of items) {
            const newUid = uid();
            await updateItemUID(item.id, newUid);
            console.log(`✓ Fixed item ${item.id}: assigned UID ${newUid}`);
        }

        console.log(`\n✓ Successfully fixed ${items.length} inbox item(s)!\n`);

        // Verify
        const remainingItems = await getItemsWithoutUID();
        if (remainingItems.length === 0) {
            console.log('✓ Verification passed: All items now have UIDs\n');
        } else {
            console.log(`⚠ Warning: ${remainingItems.length} item(s) still without UIDs\n`);
        }

    } catch (error) {
        console.error('Error fixing inbox item UIDs:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// Run the fix
fixInboxItemUIDs();
