#!/usr/bin/env node

/**
 * Generate Service Worker with actual webpack bundle names
 * This script reads the built dist/index.html and extracts the actual
 * bundle filenames, then generates a service worker that caches them.
 */

const fs = require('fs');
const path = require('path');
const swTemplate = require('./sw-template');

const regex = /<script[^>]*src=["']([^"']*\.js)["']/g;

const distDir = path.join(__dirname, '../dist');
const indexPath = path.join(distDir, 'index.html');
const swPath = path.join(distDir, 'pwa/sw.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ dist/index.html not found. Run `npm run frontend:build` first.');
  process.exit(1);
}

// Read index.html and extract script filenames
const htmlContent = fs.readFileSync(indexPath, 'utf-8');
const bundleFiles = [];
let match;

while ((match = regex.exec(htmlContent)) !== null) {
  bundleFiles.push('/' + match[1]);
}

if (bundleFiles.length === 0) {
  console.warn('⚠️  No bundle files found in index.html');
}

console.log(`📦 Found ${bundleFiles.length} bundle(s):`, bundleFiles);

// Static assets to cache
const staticAssets = [
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/favicon.png",
  "/favicon-32.png",
  "/favicon-16.png",
  "/icon-logo.png",
  "/wide-logo-dark.png",
  "/wide-logo-light.png",
  ...bundleFiles
];

// Generate the service worker content using template
const swContent = swTemplate('pwa-assets-v1', staticAssets);

// Create pwa directory if it doesn't exist
const swDir = path.dirname(swPath);
if (!fs.existsSync(swDir)) {
  fs.mkdirSync(swDir, { recursive: true });
}

// Write the service worker
fs.writeFileSync(swPath, swContent);
console.log(`✅ Generated ${swPath}`);

