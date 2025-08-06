/**
 * Suggestion Rules Engine - Functional Wrapper
 * Simple functional wrapper around the modular rules engine
 * All the actual logic has been moved to backend/rules/
 */

const modularEngine = require('../rules/engine');

// Initialize rules on module load
try {
    const rules = modularEngine.getRules();
    console.log(`Loaded ${rules.length} suggestion rules via modular engine`);
} catch (error) {
    console.error('Failed to load modular suggestion rules:', error);
}

/**
 * Reload rules
 */
function reloadRules() {
    return modularEngine.reloadRules();
}

/**
 * Generate suggestion - delegates to modular engine
 */
function generateSuggestion(
    content,
    parsed_tags,
    parsed_projects,
    cleaned_content
) {
    return modularEngine.generateSuggestion(
        content,
        parsed_tags,
        parsed_projects,
        cleaned_content
    );
}

/**
 * Get all loaded rules
 */
function getRules() {
    return modularEngine.getRules();
}

/**
 * Get rule by ID
 */
function getRuleById(id) {
    return modularEngine.getRuleById(id);
}

module.exports = {
    reloadRules,
    generateSuggestion,
    getRules,
    getRuleById,
    // Backwards compatibility - expose the main function used by the app
    analyzeText: modularEngine.analyzeText,
};
