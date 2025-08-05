const fs = require('fs');
const path = require('path');

/**
 * Load all suggestion rules from individual JSON files
 * @returns {Object} Combined rules configuration
 */
function loadSuggestionRules() {
    const rulesDir = __dirname;
    const ruleFiles = fs
        .readdirSync(rulesDir)
        .filter(
            (file) => file.endsWith('.json') && file !== 'condition-types.json'
        )
        .sort(); // Sort for consistent ordering

    const rules = [];

    // Load each rule file
    for (const file of ruleFiles) {
        try {
            const filePath = path.join(rulesDir, file);
            const ruleContent = fs.readFileSync(filePath, 'utf8');
            const rule = JSON.parse(ruleContent);
            rules.push(rule);
        } catch (error) {
            console.error(`Error loading rule file ${file}:`, error.message);
        }
    }

    // Load condition types
    let conditionTypes = {};
    try {
        const conditionTypesPath = path.join(rulesDir, 'condition-types.json');
        const conditionTypesContent = fs.readFileSync(
            conditionTypesPath,
            'utf8'
        );
        const conditionTypesData = JSON.parse(conditionTypesContent);
        conditionTypes = conditionTypesData.condition_types;
    } catch (error) {
        console.error('Error loading condition types:', error.message);
    }

    // Sort rules by priority (highest first)
    rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return {
        rules,
        condition_types: conditionTypes,
    };
}

/**
 * Get a specific rule by ID
 * @param {string} ruleId - The rule ID to find
 * @returns {Object|null} The rule object or null if not found
 */
function getRuleById(ruleId) {
    const config = loadSuggestionRules();
    return config.rules.find((rule) => rule.id === ruleId) || null;
}

/**
 * List all available rules with basic info
 * @returns {Array} Array of rule summaries
 */
function listRules() {
    const config = loadSuggestionRules();
    return config.rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
    }));
}

// Load the configuration once at module load time
const config = loadSuggestionRules();

module.exports = {
    loadSuggestionRules,
    getRuleById,
    listRules,
    // Export the config directly for backwards compatibility
    rules: config.rules,
    condition_types: config.condition_types,
};
