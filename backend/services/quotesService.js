const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// create default quotes
const createDefaultQuotes = () => [
    "Believe you can and you're halfway there.",
    'The only way to do great work is to love what you do.',
    "It always seems impossible until it's done.",
    'Focus on progress, not perfection.',
    'One task at a time leads to great accomplishments.',
];

// get quotes file path
const getQuotesFilePath = () => path.join(__dirname, '../config/quotes.yml');

// Side effect function to check if file exists
const fileExists = (filePath) => fs.existsSync(filePath);

// Side effect function to read file contents
const readFileContents = (filePath) => fs.readFileSync(filePath, 'utf8');

// parse YAML content
const parseYamlContent = (content) => {
    try {
        return yaml.load(content);
    } catch (error) {
        throw new Error(`Failed to parse YAML: ${error.message}`);
    }
};

// validate quotes data structure
const validateQuotesData = (data) =>
    !!(data && data.quotes && Array.isArray(data.quotes));

// extract quotes from data
const extractQuotes = (data) => {
    if (validateQuotesData(data)) {
        return data.quotes;
    }
    return null;
};

// Side effect function to load quotes from file
const loadQuotesFromFile = () => {
    try {
        const quotesPath = getQuotesFilePath();

        if (!fileExists(quotesPath)) {
            console.warn('Quotes configuration file not found, using defaults');
            return createDefaultQuotes();
        }

        const fileContents = readFileContents(quotesPath);
        const data = parseYamlContent(fileContents);
        const quotes = extractQuotes(data);

        if (quotes) {
            console.log(`Loaded ${quotes.length} quotes from configuration`);
            return quotes;
        } else {
            console.warn('No quotes found in configuration file');
            return createDefaultQuotes();
        }
    } catch (error) {
        console.error('Error loading quotes:', error.message);
        return createDefaultQuotes();
    }
};

// get random index
const getRandomIndex = (arrayLength) => Math.floor(Math.random() * arrayLength);

// get random quote from array
const getRandomQuoteFromArray = (quotes) => {
    if (quotes.length === 0) {
        return 'Stay focused and keep going!';
    }

    const randomIndex = getRandomIndex(quotes.length);
    return quotes[randomIndex];
};

// get all quotes
const getAllQuotesFromArray = (quotes) => [...quotes]; // Return copy to maintain immutability

// get quotes count
const getQuotesCount = (quotes) => quotes.length;

// Initialize quotes on module load
let quotes = loadQuotesFromFile();

// Function to reload quotes (contains side effects)
const reloadQuotes = () => {
    quotes = loadQuotesFromFile();
    return quotes;
};

// get random quote
const getRandomQuote = () => getRandomQuoteFromArray(quotes);

// get all quotes
const getAllQuotes = () => getAllQuotesFromArray(quotes);

// get count
const getCount = () => getQuotesCount(quotes);

// Export functional interface
module.exports = {
    getRandomQuote,
    getAllQuotes,
    getQuotesCount: getCount,
    reloadQuotes,
    // For testing
    _createDefaultQuotes: createDefaultQuotes,
    _getQuotesFilePath: getQuotesFilePath,
    _parseYamlContent: parseYamlContent,
    _validateQuotesData: validateQuotesData,
    _extractQuotes: extractQuotes,
    _getRandomIndex: getRandomIndex,
    _getRandomQuoteFromArray: getRandomQuoteFromArray,
};
