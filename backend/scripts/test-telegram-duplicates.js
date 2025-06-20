#!/usr/bin/env node

/**
 * Test runner script for Telegram duplicate prevention tests
 * 
 * Usage:
 *   node scripts/test-telegram-duplicates.js
 *   npm run test:telegram-duplicates
 */

const { execSync } = require('child_process');

console.log('🔍 Running Telegram Duplicate Prevention Tests...\n');

try {
  // Run the tests
  execSync('npm test -- --testPathPatterns="telegram.*test\\.js"', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ All Telegram duplicate prevention tests passed!');
  console.log('\n📋 Test Coverage:');
  console.log('  • Unit Tests: Core functionality and utility functions');
  console.log('  • Integration Tests: Database interactions and state management');
  console.log('  • Scenario Tests: Real-world duplicate prevention scenarios');
  console.log('  • API Tests: Telegram route endpoints and authentication');
  
} catch (error) {
  console.error('\n❌ Some tests failed. Please review the output above.');
  process.exit(1);
}