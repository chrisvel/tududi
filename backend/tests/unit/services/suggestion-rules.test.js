/**
 * Tests for suggestion rules engine
 * Ensures meeting notes and similar content are correctly classified
 */

const InboxProcessingService = require('../../../services/inboxProcessingService');
const suggestionRulesEngine = require('../../../services/suggestionRulesEngine');
const testCases = require('../../fixtures/suggestion-rule-test-cases.json');

describe('Suggestion Rules Engine', () => {
    describe('Long Text Notes', () => {
        testCases.long_text_notes.forEach((testCase) => {
            test(`should classify ${testCase.name.toLowerCase()} as note`, () => {
                const result = analyzeText(testCase.text);

                expect(result.suggested_type).toBe(testCase.expected_type);
                expect(result.suggested_reason).toBe(testCase.expected_reason);
            });
        });
    });

    describe('Actionable Tasks Detection', () => {
        testCases.actionable_tasks.forEach((testCase) => {
            test(`should classify ${testCase.name.toLowerCase()} as task`, () => {
                const result = analyzeText(testCase.text);

                expect(result.suggested_type).toBe(testCase.expected_type);
                expect(result.suggested_reason).toBe(testCase.expected_reason);
            });
        });
    });

    describe('Long Text Fallback', () => {
        testCases.long_text_fallback.forEach((testCase) => {
            test(`should classify ${testCase.name.toLowerCase()} as note via fallback`, () => {
                const result = analyzeText(testCase.text);

                expect(result.suggested_type).toBe(testCase.expected_type);
                expect(result.suggested_reason).toBe(testCase.expected_reason);
            });
        });
    });

    describe('Edge Cases', () => {
        testCases.edge_cases.forEach((testCase) => {
            test(`should handle ${testCase.name.toLowerCase()} correctly`, () => {
                const result = analyzeText(testCase.text);

                expect(result.suggested_type).toBe(testCase.expected_type);
                expect(result.suggested_reason).toBe(testCase.expected_reason);
            });
        });
    });

    describe('Rule Priority Order', () => {
        test('should have correct rule priority ordering', () => {
            const rules = suggestionRulesEngine.getRules();

            // Key rules should be in expected order
            const todayTomorrowRule = rules.find(
                (r) => r.id === 'specific_time_today_tomorrow'
            );
            const longTextRule = rules.find((r) => r.id === 'long_text_note');

            expect(todayTomorrowRule).toBeDefined();
            expect(longTextRule).toBeDefined();

            // Long text rule should now have higher priority than time-specific rules
            expect(longTextRule.priority).toBeGreaterThan(
                todayTomorrowRule.priority
            );
        });

        test('should load all expected rules', () => {
            const rules = suggestionRulesEngine.getRules();

            // Should have at least 7 rules loaded
            expect(rules.length).toBeGreaterThanOrEqual(7);

            // Check for key rule IDs
            const ruleIds = rules.map((r) => r.id);
            expect(ruleIds).toContain('specific_time_today_tomorrow');
            expect(ruleIds).toContain('long_text_note');
            expect(ruleIds).toContain('verb_with_project_task');
        });
    });
});

/**
 * Helper function to analyze text using the suggestion rules engine
 */
function analyzeText(content) {
    const parsed_tags = InboxProcessingService.parseHashtags(content);
    const parsed_projects = InboxProcessingService.parseProjectRefs(content);
    const cleaned_content =
        InboxProcessingService.cleanTextFromTagsAndProjects(content);

    const suggestion = suggestionRulesEngine.generateSuggestion(
        content,
        parsed_tags,
        parsed_projects,
        cleaned_content
    );

    return {
        suggested_type: suggestion.type,
        suggested_reason: suggestion.reason,
        suggested_tags: suggestion.tags,
        suggested_priority: suggestion.priority,
        suggested_due_date: suggestion.due_date,
    };
}
