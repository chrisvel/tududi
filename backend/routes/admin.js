const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Middleware to check admin access (you might want to add proper authentication)
const requireAdmin = (req, res, next) => {
    // For now, just check if user is authenticated
    // In production, you'd want proper admin role checking
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// GET /api/admin/rules - Get all suggestion rules
router.get('/admin/rules', requireAdmin, async (req, res) => {
    try {
        const rulesEngine = require('../services/suggestionRulesEngine');
        const rules = rulesEngine.getRules();

        // Convert modular rules to expected format
        const formattedRules = rules.map((rule) => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            priority: rule.priority,
            examples: rule.examples || [],
            conditions: rule.conditions,
            action: rule.action,
        }));

        res.json({
            rules: formattedRules,
            condition_types: {}, // Legacy field, not used in modular system
            total_rules: formattedRules.length,
            rules_by_priority: formattedRules.sort(
                (a, b) => b.priority - a.priority
            ),
        });
    } catch (error) {
        console.error('Error loading rules:', error);
        res.status(500).json({ error: 'Failed to load rules configuration' });
    }
});

// GET /api/admin/rules/stats - Get rules statistics
router.get('/admin/rules/stats', requireAdmin, async (req, res) => {
    try {
        const rulesEngine = require('../services/suggestionRulesEngine');
        const rules = rulesEngine.getRules();

        // Calculate statistics
        const stats = {
            total_rules: rules.length,
            task_rules: rules.filter((r) => r.action.suggested_type === 'task')
                .length,
            note_rules: rules.filter((r) => r.action.suggested_type === 'note')
                .length,
            priority_distribution: {},
            condition_types_used: {},
            most_common_reasons: {},
        };

        // Priority distribution
        rules.forEach((rule) => {
            const priority = rule.priority;
            stats.priority_distribution[priority] =
                (stats.priority_distribution[priority] || 0) + 1;
        });

        // Condition types used
        const countConditionTypes = (conditions) => {
            if (conditions.and) {
                conditions.and.forEach(countConditionTypes);
            } else if (conditions.or) {
                conditions.or.forEach(countConditionTypes);
            } else if (conditions.type) {
                stats.condition_types_used[conditions.type] =
                    (stats.condition_types_used[conditions.type] || 0) + 1;
            }
        };

        rules.forEach((rule) => {
            countConditionTypes(rule.conditions);
            const reason = rule.action.suggested_reason;
            stats.most_common_reasons[reason] =
                (stats.most_common_reasons[reason] || 0) + 1;
        });

        res.json(stats);
    } catch (error) {
        console.error('Error calculating rules stats:', error);
        res.status(500).json({ error: 'Failed to calculate rules statistics' });
    }
});

// POST /api/admin/rules/test - Test a rule against sample text
router.post('/admin/rules/test', requireAdmin, async (req, res) => {
    try {
        const { text, rule_id } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const InboxProcessingService = require('../services/inboxProcessingService');
        const result = InboxProcessingService.processInboxItem(text);

        // If rule_id is specified, check if that specific rule matched
        let rule_matched = false;
        if (rule_id) {
            // This would require extending the rules engine to return which rule matched
            // For now, we'll just return the general result
        }

        res.json({
            input: text,
            result: {
                parsed_tags: result.parsed_tags,
                parsed_projects: result.parsed_projects,
                cleaned_content: result.cleaned_content,
                suggested_type: result.suggested_type,
                suggested_reason: result.suggested_reason,
            },
            rule_matched: rule_matched,
        });
    } catch (error) {
        console.error('Error testing rule:', error);
        res.status(500).json({ error: 'Failed to test rule' });
    }
});

// POST /api/admin/rules/reload - Reload rules from configuration
router.post('/admin/rules/reload', requireAdmin, async (req, res) => {
    try {
        const rulesEngine = require('../services/suggestionRulesEngine');
        rulesEngine.reloadRules();
        res.json({ message: 'Rules reloaded successfully' });
    } catch (error) {
        console.error('Error reloading rules:', error);
        res.status(500).json({ error: 'Failed to reload rules' });
    }
});

module.exports = router;
