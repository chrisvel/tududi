const path = require('path');
const { loadModularRules } = require('./loader');

let rulesCache = null;

const loadRules = () => {
    try {
        const config = loadModularRules();
        rulesCache = config.rules;
        return config;
    } catch (error) {
        console.error('Failed to load modular suggestion rules:', error);
        rulesCache = [];
        return { rules: [], condition_types: {} };
    }
};

const getRules = () => {
    if (rulesCache === null) {
        loadRules();
    }
    return rulesCache || [];
};

const reloadRules = () => {
    const rulesDir = path.join(__dirname, 'modules');

    Object.keys(require.cache).forEach((key) => {
        if (key.startsWith(rulesDir)) {
            delete require.cache[key];
        }
    });

    rulesCache = null;
    const config = loadRules();
    console.log(`Reloaded ${config.rules.length} modular suggestion rules`);
    return config.rules;
};

const evaluateRule = (rule, context) => {
    try {
        return rule.evaluate ? rule.evaluate(context) : false;
    } catch (error) {
        console.error(`Error evaluating modular rule ${rule.id}:`, error);
        return false;
    }
};

const processRuleAction = (rule, context) => {
    if (rule.processAction && typeof rule.processAction === 'function') {
        return rule.processAction(context);
    }
    return rule.action;
};

const findMatchingRules = (rules, context) => {
    return rules.filter((rule) => evaluateRule(rule, context));
};

const combineSuggestions = (matchingRules, context) => {
    const allSuggestedTags = [];
    let combinedPriority = null;
    let combinedDueDate = null;

    for (const rule of matchingRules) {
        const ruleAction = processRuleAction(rule, context);

        if (
            ruleAction.suggested_tags &&
            Array.isArray(ruleAction.suggested_tags)
        ) {
            allSuggestedTags.push(...ruleAction.suggested_tags);
        }

        if (!combinedPriority && ruleAction.suggested_priority) {
            combinedPriority = ruleAction.suggested_priority;
        }

        if (!combinedDueDate && ruleAction.suggested_due_date) {
            combinedDueDate = ruleAction.suggested_due_date;
        }
    }

    return {
        tags:
            allSuggestedTags.length > 0
                ? [...new Set(allSuggestedTags)]
                : undefined,
        priority: combinedPriority,
        due_date: combinedDueDate,
    };
};

const generateSuggestion = (
    content,
    parsed_tags,
    parsed_projects,
    cleaned_content
) => {
    const rules = getRules();

    if (!rules || rules.length === 0) {
        throw new Error(
            'No modular rules loaded, falling back to original logic'
        );
    }

    const context = {
        content,
        parsed_tags,
        parsed_projects,
        cleaned_content,
    };

    const matchingRules = findMatchingRules(rules, context);

    if (matchingRules.length === 0) {
        return { type: null, reason: null };
    }

    const primaryRule = matchingRules[0];
    const processedAction = processRuleAction(primaryRule, context);

    const suggestion = {
        type: processedAction.suggested_type,
        reason: processedAction.suggested_reason,
        rule_id: primaryRule.id,
        rule_name: primaryRule.name,
    };

    const combined = combineSuggestions(matchingRules, context);

    if (combined.priority) {
        suggestion.priority = combined.priority;
    }
    if (combined.tags) {
        suggestion.tags = combined.tags;
    }
    if (combined.due_date) {
        suggestion.due_date = combined.due_date;
    }

    return suggestion;
};

const getRuleById = (id) => {
    const rules = getRules();
    return rules.find((rule) => rule.id === id) || null;
};

module.exports = {
    loadRules,
    getRules,
    reloadRules,
    generateSuggestion,
    getRuleById,
    evaluateRule,
    processRuleAction,
    findMatchingRules,
    combineSuggestions,
};
