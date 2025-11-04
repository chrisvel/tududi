const path = require('path');

module.exports = {
  localesDir: path.join(__dirname, 'public/locales'),
  baseLanguage: 'en',
  translationFiles: ['translation.json', 'quotes.json'],
  batchSize: 20,
  model: 'gpt-4o-mini',
  temperature: 0.3,
};
