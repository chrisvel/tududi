const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class QuotesService {
  constructor() {
    this.quotes = [];
    this.loadQuotes();
  }

  loadQuotes() {
    try {
      const quotesPath = path.join(__dirname, '../config/quotes.yml');
      
      if (fs.existsSync(quotesPath)) {
        const fileContents = fs.readFileSync(quotesPath, 'utf8');
        const data = yaml.load(fileContents);
        
        if (data && data.quotes && Array.isArray(data.quotes)) {
          this.quotes = data.quotes;
          console.log(`Loaded ${this.quotes.length} quotes from configuration`);
        } else {
          console.warn('No quotes found in configuration file');
          this.setDefaultQuotes();
        }
      } else {
        console.warn('Quotes configuration file not found, using defaults');
        this.setDefaultQuotes();
      }
    } catch (error) {
      console.error('Error loading quotes:', error.message);
      this.setDefaultQuotes();
    }
  }

  setDefaultQuotes() {
    this.quotes = [
      "Believe you can and you're halfway there.",
      "The only way to do great work is to love what you do.",
      "It always seems impossible until it's done.",
      "Focus on progress, not perfection.",
      "One task at a time leads to great accomplishments."
    ];
  }

  getRandomQuote() {
    if (this.quotes.length === 0) {
      return "Stay focused and keep going!";
    }
    
    const randomIndex = Math.floor(Math.random() * this.quotes.length);
    return this.quotes[randomIndex];
  }

  getAllQuotes() {
    return this.quotes;
  }

  getQuotesCount() {
    return this.quotes.length;
  }
}

// Export singleton instance
module.exports = new QuotesService();