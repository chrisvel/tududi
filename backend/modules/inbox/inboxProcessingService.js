/**
 * Inbox Item Processing Service
 * Handles text analysis and suggestion generation for inbox items
 */

const nlp = require('compromise');

// Helper constants
const AUXILIARY_VERBS = [
    'be',
    'is',
    'am',
    'are',
    'was',
    'were',
    'being',
    'been',
    'have',
    'has',
    'had',
    'having',
    'does',
    'did',
    'doing',
    'will',
    'would',
    'shall',
    'should',
    'may',
    'might',
    'can',
    'could',
    'must',
    'ought',
];

/**
 * Check if a word is an action verb using NLP
 * @param {string} word - Word to check
 * @returns {boolean} True if the word is an action verb
 */
const isActionVerb = (word) => {
    if (!word || typeof word !== 'string') return false;

    try {
        const doc = nlp(word.toLowerCase());
        const verbs = doc.verbs();

        if (verbs.length === 0) return false;

        // Check if it's an action verb (not auxiliary/linking verbs when used alone)
        const text = verbs.text().toLowerCase();

        // Allow "do" when it's part of an action phrase like "do something"
        if (text === 'do') {
            // Check the original word context to see if it's followed by a noun/action
            return true; // For now, allow "do" - could refine this logic later
        }

        return !AUXILIARY_VERBS.includes(text);
    } catch (error) {
        console.error('Error checking verb:', error);
        return false;
    }
};

/**
 * Tokenize text handling quoted strings properly
 * @param {string} text - Text to tokenize
 * @returns {string[]} Array of tokens
 */
const tokenizeText = (text) => {
    const tokens = [];
    let currentToken = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const char = text[i];

        if (char === '"' && (i === 0 || text[i - 1] === '+')) {
            // Start of a quoted string after +
            inQuotes = true;
            currentToken += char;
        } else if (char === '"' && inQuotes) {
            // End of quoted string
            inQuotes = false;
            currentToken += char;
        } else if (char === ' ' && !inQuotes) {
            // Space outside quotes - end current token
            if (currentToken) {
                tokens.push(currentToken);
                currentToken = '';
            }
        } else {
            // Regular character
            currentToken += char;
        }
        i++;
    }

    // Add final token
    if (currentToken) {
        tokens.push(currentToken);
    }

    return tokens;
};

/**
 * Parse hashtags from text (consecutive groups anywhere)
 * @param {string} text - Text to parse
 * @returns {string[]} Array of hashtag names
 */
const parseHashtags = (text) => {
    const trimmedText = text.trim();
    const matches = [];

    // Split text into words
    const words = trimmedText.split(/\s+/);
    if (words.length === 0) return matches;

    // Find all consecutive groups of tags/projects
    let i = 0;
    while (i < words.length) {
        // Check if current word starts a tag/project group
        if (words[i].startsWith('#') || words[i].startsWith('+')) {
            // Found start of a group, collect all consecutive tags/projects
            let groupEnd = i;
            while (
                groupEnd < words.length &&
                (words[groupEnd].startsWith('#') ||
                    words[groupEnd].startsWith('+'))
            ) {
                groupEnd++;
            }

            // Process all hashtags in this group
            for (let j = i; j < groupEnd; j++) {
                if (words[j].startsWith('#')) {
                    const tagName = words[j].substring(1);
                    if (
                        tagName &&
                        /^[a-zA-Z0-9_-]+$/.test(tagName) &&
                        !matches.includes(tagName)
                    ) {
                        matches.push(tagName);
                    }
                }
            }

            // Skip to end of this group
            i = groupEnd;
        } else {
            i++;
        }
    }

    return matches;
};

/**
 * Parse project references from text (consecutive groups anywhere)
 * @param {string} text - Text to parse
 * @returns {string[]} Array of project names
 */
const parseProjectRefs = (text) => {
    const trimmedText = text.trim();
    const matches = [];

    // Tokenize the text handling quoted strings properly
    const tokens = tokenizeText(trimmedText);

    // Find consecutive groups of tags/projects
    let i = 0;
    while (i < tokens.length) {
        // Check if current token starts a tag/project group
        if (tokens[i].startsWith('#') || tokens[i].startsWith('+')) {
            // Found start of a group, collect all consecutive tags/projects
            let groupEnd = i;
            while (
                groupEnd < tokens.length &&
                (tokens[groupEnd].startsWith('#') ||
                    tokens[groupEnd].startsWith('+'))
            ) {
                groupEnd++;
            }

            // Process all project references in this group
            for (let j = i; j < groupEnd; j++) {
                if (tokens[j].startsWith('+')) {
                    let projectName = tokens[j].substring(1);

                    // Handle quoted project names
                    if (
                        projectName.startsWith('"') &&
                        projectName.endsWith('"')
                    ) {
                        projectName = projectName.slice(1, -1);
                    }

                    if (projectName && !matches.includes(projectName)) {
                        matches.push(projectName);
                    }
                }
            }

            // Skip to end of this group
            i = groupEnd;
        } else {
            i++;
        }
    }

    return matches;
};

/**
 * Clean text by removing tags and project references (consecutive groups anywhere)
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
const cleanTextFromTagsAndProjects = (text) => {
    const trimmedText = text.trim();
    const tokens = tokenizeText(trimmedText);
    const cleanedTokens = [];

    let i = 0;
    while (i < tokens.length) {
        // Check if current token starts a tag/project group
        if (tokens[i].startsWith('#') || tokens[i].startsWith('+')) {
            // Skip this entire consecutive group
            while (
                i < tokens.length &&
                (tokens[i].startsWith('#') || tokens[i].startsWith('+'))
            ) {
                i++;
            }
        } else {
            // Keep regular tokens
            cleanedTokens.push(tokens[i]);
            i++;
        }
    }

    return cleanedTokens.join(' ').trim();
};

/**
 * Check if text starts with an action verb using NLP
 * @param {string} text - Text to analyze
 * @returns {boolean} True if starts with verb
 */
const startsWithVerb = (text) => {
    if (!text.trim()) return false;

    try {
        const firstWord = text.trim().split(/\s+/)[0];
        if (!firstWord) return false;

        return isActionVerb(firstWord);
    } catch (error) {
        console.error('Error checking if text starts with verb:', error);
        return false;
    }
};

/**
 * Check if text contains a URL
 * @param {string} text - Text to check
 * @returns {boolean} True if contains URL
 */
const containsUrl = (text) => {
    const urlRegex = /https?:\/\/[^\s]+/i;
    return urlRegex.test(text);
};

/**
 * Generate suggestion for an inbox item
 * @param {string} content - Original content
 * @param {string[]} tags - Parsed tags
 * @param {string[]} projects - Parsed projects
 * @param {string} cleanedContent - Cleaned content
 * @returns {object} Suggestion object
 */
const generateSuggestion = (content, tags, projects, cleanedContent) => {
    const hasProject = projects.length > 0;
    const hasBookmarkTag = tags.some((tag) => tag.toLowerCase() === 'bookmark');
    const textStartsWithVerb = startsWithVerb(cleanedContent);
    const hasUrl = containsUrl(content);

    if (!hasProject) {
        return { type: null, reason: null };
    }

    // Suggest note for bookmark items with project (explicit bookmark tag)
    if (hasBookmarkTag) {
        return {
            type: 'note',
            reason: 'bookmark_tag',
        };
    }

    // Suggest note for URLs with project (auto-bookmark)
    if (hasUrl) {
        return {
            type: 'note',
            reason: 'url_detected',
        };
    }

    // Suggest task for items with project that start with a verb
    if (textStartsWithVerb) {
        return {
            type: 'task',
            reason: 'verb_detected',
        };
    }

    return { type: null, reason: null };
};

/**
 * Process inbox item content and generate metadata
 * @param {string} content - Inbox item content
 * @returns {object} Processing results
 */
const processInboxItem = (content) => {
    // Parse the content
    const tags = parseHashtags(content);
    const projects = parseProjectRefs(content);
    const cleanedContent = cleanTextFromTagsAndProjects(content);

    // Generate suggestion
    const suggestion = generateSuggestion(
        content,
        tags,
        projects,
        cleanedContent
    );

    return {
        parsed_tags: tags,
        parsed_projects: projects,
        cleaned_content: cleanedContent,
        suggested_type: suggestion.type,
        suggested_reason: suggestion.reason,
    };
};

module.exports = {
    // Core processing functions
    processInboxItem,

    // Text analysis functions
    isActionVerb,
    startsWithVerb,
    containsUrl,

    // Parsing functions
    parseHashtags,
    parseProjectRefs,
    cleanTextFromTagsAndProjects,
    tokenizeText,

    // Suggestion generation
    generateSuggestion,
};
