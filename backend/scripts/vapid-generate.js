#!/usr/bin/env node

/**
 * VAPID Key Generator
 * Generates VAPID keys for Web Push Notifications
 *
 * Usage: npm run vapid:generate
 */

const webpush = require('web-push');

console.log('🔐 Generating VAPID keys for Web Push Notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('═══════════════════════════════════════════════════════');
console.log('Public Key (safe to expose to frontend):');
console.log('═══════════════════════════════════════════════════════');
console.log(vapidKeys.publicKey);

console.log('\n═══════════════════════════════════════════════════════');
console.log('Private Key (⚠️  KEEP SECRET - never commit):');
console.log('═══════════════════════════════════════════════════════');
console.log(vapidKeys.privateKey);

console.log('\n═══════════════════════════════════════════════════════');
console.log('Add these to your environment:');
console.log('═══════════════════════════════════════════════════════\n');

console.log('# Development (backend/.env)');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@example.com\n`);

console.log('# Production (use secrets management)');
console.log('Docker:');
console.log(`  -e VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`  -e VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`  -e VAPID_SUBJECT=mailto:your-email@example.com`);

console.log('\n🔒 Security Notes:');
console.log('- Use different keys for development and production');
console.log('- Never commit VAPID keys to version control');
console.log(
    '- Store production keys in secrets management (Docker secrets, K8s, etc.)'
);
console.log('- Change VAPID_SUBJECT to your contact email or website URL\n');
