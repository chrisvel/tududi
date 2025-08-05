/**
 * Suggestion Rules Engine
 * Processes inbox items against configurable rules to generate suggestions
 */

const fs = require('fs');
const path = require('path');
const InboxProcessingService = require('./inboxProcessingService');
const suggestionRulesConfig = require('../config/suggestion-rules');

class SuggestionRulesEngine {
    constructor() {
        this.rules = [];
        this.loadRules();
    }

    /**
     * Load rules from individual JSON files
     */
    loadRules() {
        try {
            if (
                !suggestionRulesConfig.rules ||
                !Array.isArray(suggestionRulesConfig.rules)
            ) {
                throw new Error(
                    'Invalid rules configuration: rules property must be an array'
                );
            }

            this.rules = suggestionRulesConfig.rules; // Already sorted by priority in loadSuggestionRules
            console.log(
                `Loaded ${this.rules.length} suggestion rules from individual files`
            );
        } catch (error) {
            console.error('Failed to load suggestion rules:', error);
            this.rules = [];
        }
    }

    /**
     * Reload rules from individual files (for hot reloading)
     */
    reloadRules() {
        // Clear the require cache for the suggestion rules module
        delete require.cache[require.resolve('../config/suggestion-rules')];
        // Re-require the module to get fresh data
        const freshConfig = require('../config/suggestion-rules');
        this.rules = freshConfig.rules;
        console.log(
            `Reloaded ${this.rules.length} suggestion rules from individual files`
        );
    }

    /**
     * Evaluate a single condition
     * @param {object} condition - The condition to evaluate
     * @param {object} context - The context data (parsed content, tags, projects, etc.)
     * @returns {boolean} True if condition is met
     */
    evaluateCondition(condition, context) {
        const { type, value, operator = 'eq' } = condition;

        switch (type) {
            case 'has_project':
                return value
                    ? context.parsed_projects.length > 0
                    : context.parsed_projects.length === 0;

            case 'has_tag':
                return context.parsed_tags.some(
                    (tag) => tag.toLowerCase() === value.toLowerCase()
                );

            case 'starts_with_verb':
                return value
                    ? InboxProcessingService.startsWithVerb(
                          context.cleaned_content
                      )
                    : !InboxProcessingService.startsWithVerb(
                          context.cleaned_content
                      );

            case 'contains_url':
                return value
                    ? InboxProcessingService.containsUrl(context.content)
                    : !InboxProcessingService.containsUrl(context.content);

            case 'contains_keywords':
                if (!Array.isArray(value)) return false;
                const contentLower = context.content.toLowerCase();
                return value.some((keyword) =>
                    contentLower.includes(keyword.toLowerCase())
                );

            case 'text_length':
                const wordCount = context.cleaned_content
                    .split(/\s+/)
                    .filter((word) => word.length > 0).length;
                return this.compareNumbers(wordCount, value, operator);

            case 'tag_count':
                return this.compareNumbers(
                    context.parsed_tags.length,
                    value,
                    operator
                );

            case 'project_name_matches':
                return context.parsed_projects.some(
                    (project) => project.toLowerCase() === value.toLowerCase()
                );

            case 'contains_time_reference':
                const timeKeywords = [
                    'tomorrow',
                    'today',
                    'yesterday',
                    'deadline',
                    'due',
                    'schedule',
                    'appointment',
                    'by',
                    'before',
                    'after',
                    'next week',
                    'this week',
                    'monday',
                    'tuesday',
                    'wednesday',
                    'thursday',
                    'friday',
                    'saturday',
                    'sunday',
                ];
                const contentLowerTime = context.content.toLowerCase();
                const hasTimeRef = timeKeywords.some((keyword) =>
                    contentLowerTime.includes(keyword.toLowerCase())
                );
                return value ? hasTimeRef : !hasTimeRef;

            case 'is_question':
                const questionWords = [
                    'what',
                    'when',
                    'where',
                    'who',
                    'why',
                    'how',
                    'which',
                    'can',
                    'could',
                    'would',
                    'should',
                    'will',
                    'do',
                    'does',
                    'did',
                    'is',
                    'are',
                    'was',
                    'were',
                ];
                const contentLowerQuestion = context.content.toLowerCase();
                const endsWithQuestion = context.content.trim().endsWith('?');
                const startsWithQuestionWord = questionWords.some((word) =>
                    contentLowerQuestion.startsWith(word + ' ')
                );
                const isQuestionText =
                    endsWithQuestion || startsWithQuestionWord;
                return value ? isQuestionText : !isQuestionText;

            case 'contains_priority_keywords':
                if (!Array.isArray(value)) return false;
                const contentLowerPriority = context.content.toLowerCase();
                return value.some((keyword) =>
                    contentLowerPriority.includes(keyword.toLowerCase())
                );

            case 'is_long_text':
                return value
                    ? InboxProcessingService.isLongText(context.content)
                    : !InboxProcessingService.isLongText(context.content);

            case 'contains_code':
                return value
                    ? InboxProcessingService.containsCode(context.content)
                    : !InboxProcessingService.containsCode(context.content);

            default:
                console.warn(`Unknown condition type: ${type}`);
                return false;
        }
    }

    /**
     * Compare numbers with operators
     * @param {number} actual - Actual value
     * @param {number} expected - Expected value
     * @param {string} operator - Comparison operator
     * @returns {boolean} Comparison result
     */
    compareNumbers(actual, expected, operator) {
        switch (operator) {
            case 'gt':
                return actual > expected;
            case 'lt':
                return actual < expected;
            case 'eq':
                return actual === expected;
            case 'gte':
                return actual >= expected;
            case 'lte':
                return actual <= expected;
            default:
                return actual === expected;
        }
    }

    /**
     * Evaluate a group of conditions with logical operators
     * @param {object} conditions - The conditions group (and/or)
     * @param {object} context - The context data
     * @returns {boolean} True if conditions are met
     */
    evaluateConditions(conditions, context) {
        if (conditions.and) {
            return conditions.and.every((condition) =>
                this.evaluateCondition(condition, context)
            );
        }

        if (conditions.or) {
            return conditions.or.some((condition) =>
                this.evaluateCondition(condition, context)
            );
        }

        // Single condition
        return this.evaluateCondition(conditions, context);
    }

    /**
     * Generate suggestion based on rules
     * @param {string} content - Original content
     * @param {string[]} parsed_tags - Parsed tags
     * @param {string[]} parsed_projects - Parsed projects
     * @param {string} cleaned_content - Cleaned content
     * @returns {object} Suggestion object
     */
    generateSuggestion(content, parsed_tags, parsed_projects, cleaned_content) {
        // If no rules are loaded, throw an error to trigger fallback
        if (!this.rules || this.rules.length === 0) {
            throw new Error('No rules loaded, falling back to hardcoded logic');
        }

        const context = {
            content,
            parsed_tags,
            parsed_projects,
            cleaned_content,
        };

        // Collect all matching rules and combine their suggestions
        const matchingRules = [];
        for (const rule of this.rules) {
            try {
                if (this.evaluateConditions(rule.conditions, context)) {
                    matchingRules.push(rule);
                }
            } catch (error) {
                console.error(`Error evaluating rule ${rule.id}:`, error);
            }
        }

        if (matchingRules.length === 0) {
            return { type: null, reason: null };
        }

        // Use the highest priority rule for main suggestion
        const primaryRule = matchingRules[0]; // Already sorted by priority
        const suggestion = {
            type: primaryRule.action.suggested_type,
            reason: primaryRule.action.suggested_reason,
            rule_id: primaryRule.id,
            rule_name: primaryRule.name,
        };

        // Combine suggestions from all matching rules
        const allSuggestedTags = [];
        let combinedPriority = null;
        let combinedDueDate = null;

        for (const rule of matchingRules) {
            // Collect tags from all matching rules
            if (
                rule.action.suggested_tags &&
                Array.isArray(rule.action.suggested_tags)
            ) {
                allSuggestedTags.push(...rule.action.suggested_tags);
            }

            // Use highest priority rule's priority (first in sorted order)
            if (!combinedPriority && rule.action.suggested_priority) {
                combinedPriority = rule.action.suggested_priority;
            }

            // Use highest priority rule's due date (first in sorted order)
            if (!combinedDueDate && rule.action.suggested_due_date) {
                combinedDueDate = this.parseDueDate(
                    rule.action.suggested_due_date,
                    context
                );
            }
        }

        // Add combined metadata
        if (combinedPriority) {
            suggestion.priority = combinedPriority;
        }

        if (allSuggestedTags.length > 0) {
            // Remove duplicates while preserving order
            suggestion.tags = [...new Set(allSuggestedTags)];
        }

        if (combinedDueDate) {
            suggestion.due_date = combinedDueDate;
        }

        return suggestion;
    }

    /**
     * Get all loaded rules (for debugging/admin interface)
     * @returns {array} Array of rules
     */
    getRules() {
        return this.rules;
    }

    /**
     * Get rule by ID
     * @param {string} id - Rule ID
     * @returns {object|null} Rule object or null if not found
     */
    getRuleById(id) {
        return this.rules.find((rule) => rule.id === id) || null;
    }

    /**
     * Parse due date from rule configuration
     * @param {object} dueDateConfig - Due date configuration from rule
     * @param {object} context - Context data for parsing relative dates
     * @returns {string|null} Due date string or null
     */
    parseDueDate(dueDateConfig, context) {
        if (!dueDateConfig || dueDateConfig.type === 'none') {
            return null;
        }

        const now = new Date();

        if (dueDateConfig.type === 'relative') {
            switch (dueDateConfig.value) {
                case 'today':
                    return now.toISOString().split('T')[0];
                case 'tomorrow':
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return tomorrow.toISOString().split('T')[0];
                case 'next_week':
                    const nextWeek = new Date(now);
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    return nextWeek.toISOString().split('T')[0];
                default:
                    return null;
            }
        }

        if (dueDateConfig.type === 'extracted') {
            // Try to extract date from content using simple patterns
            const content = context.content.toLowerCase();

            if (content.includes('today')) {
                return now.toISOString().split('T')[0];
            }

            if (content.includes('tomorrow')) {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return tomorrow.toISOString().split('T')[0];
            }

            // Look for "by friday", "next monday", etc.
            const dayMatches = content.match(
                /(by|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/
            );
            if (dayMatches) {
                const dayName = dayMatches[2];
                const targetDay = this.getNextWeekday(dayName);
                return targetDay.toISOString().split('T')[0];
            }
        }

        return null;
    }

    /**
     * Get next occurrence of a weekday
     * @param {string} dayName - Name of the day
     * @returns {Date} Next occurrence of that day
     */
    getNextWeekday(dayName) {
        const days = [
            'sunday',
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
        ];
        const targetDay = days.indexOf(dayName.toLowerCase());

        const now = new Date();
        const currentDay = now.getDay();

        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) {
            daysToAdd += 7; // Next week
        }

        const result = new Date(now);
        result.setDate(result.getDate() + daysToAdd);
        return result;
    }
}

// Create singleton instance
const rulesEngine = new SuggestionRulesEngine();

module.exports = rulesEngine;
