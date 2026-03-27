/**
 * Service Worker Template Generator
 * Reads public/pwa/sw.js and replaces placeholders with actual values
 * 
 * Placeholders in source file:
 * - __CACHE_NAME__: The cache version identifier
 * - __STATIC_ASSETS__: JSON array of static asset URLs to cache
 */

const fs = require('fs');
const path = require('path');

const swSourcePath = path.join(__dirname, '../public/pwa/sw.js');

module.exports = (cacheName, staticAssets) => {
  // Read the source service worker file
  let swContent = fs.readFileSync(swSourcePath, 'utf-8');
  
  // Replace placeholders with actual values
  swContent = swContent.replace(
    '"__CACHE_NAME__"',
    JSON.stringify(cacheName)
  );
  swContent = swContent.replace(
    '__STATIC_ASSETS__',
    JSON.stringify(staticAssets, null, 2)
  );
  
  return swContent;
};

