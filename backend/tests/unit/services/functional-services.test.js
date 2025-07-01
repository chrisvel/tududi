const taskScheduler = require('../../../services/taskScheduler');
const telegramPoller = require('../../../services/telegramPoller');
const quotesService = require('../../../services/quotesService');
const taskSummaryService = require('../../../services/taskSummaryService');

describe('Functional Services', () => {
    describe('TaskScheduler', () => {
        it('should export functional interface', () => {
            expect(typeof taskScheduler.initialize).toBe('function');
            expect(typeof taskScheduler.stop).toBe('function');
            expect(typeof taskScheduler.restart).toBe('function');
            expect(typeof taskScheduler.getStatus).toBe('function');
        });

        it('should have pure helper functions for testing', () => {
            expect(typeof taskScheduler._createSchedulerState).toBe('function');
            expect(typeof taskScheduler._shouldDisableScheduler).toBe(
                'function'
            );
            expect(typeof taskScheduler._getCronExpression).toBe('function');
        });

        it('should return proper cron expressions', () => {
            expect(taskScheduler._getCronExpression('daily')).toBe('0 7 * * *');
            expect(taskScheduler._getCronExpression('weekly')).toBe(
                '0 7 * * 1'
            );
            expect(taskScheduler._getCronExpression('1h')).toBe('0 * * * *');
        });
    });

    describe('TelegramPoller', () => {
        it('should export functional interface', () => {
            expect(typeof telegramPoller.addUser).toBe('function');
            expect(typeof telegramPoller.removeUser).toBe('function');
            expect(typeof telegramPoller.getStatus).toBe('function');
            expect(typeof telegramPoller.sendTelegramMessage).toBe('function');
        });

        it('should have pure helper functions for testing', () => {
            expect(typeof telegramPoller._userExistsInList).toBe('function');
            expect(typeof telegramPoller._addUserToList).toBe('function');
            expect(typeof telegramPoller._removeUserFromList).toBe('function');
            expect(typeof telegramPoller._createMessageParams).toBe('function');
        });

        it('should handle user list operations functionally', () => {
            const users = [{ id: 1 }, { id: 2 }];
            const newUser = { id: 3 };

            expect(telegramPoller._userExistsInList(users, 1)).toBe(true);
            expect(telegramPoller._userExistsInList(users, 3)).toBe(false);

            const updatedUsers = telegramPoller._addUserToList(users, newUser);
            expect(updatedUsers).toHaveLength(3);
            expect(users).toHaveLength(2); // Original array unchanged

            const filteredUsers = telegramPoller._removeUserFromList(
                updatedUsers,
                2
            );
            expect(filteredUsers).toHaveLength(2);
            expect(filteredUsers.find((u) => u.id === 2)).toBeUndefined();
        });
    });

    describe('QuotesService', () => {
        it('should export functional interface', () => {
            expect(typeof quotesService.getRandomQuote).toBe('function');
            expect(typeof quotesService.getAllQuotes).toBe('function');
            expect(typeof quotesService.getQuotesCount).toBe('function');
            expect(typeof quotesService.reloadQuotes).toBe('function');
        });

        it('should have pure helper functions for testing', () => {
            expect(typeof quotesService._createDefaultQuotes).toBe('function');
            expect(typeof quotesService._getRandomIndex).toBe('function');
            expect(typeof quotesService._validateQuotesData).toBe('function');
        });

        it('should validate quotes data structure correctly', () => {
            const validData = { quotes: ['quote1', 'quote2'] };
            const invalidData1 = { quotes: 'not-array' };
            const invalidData2 = { notQuotes: ['quote1'] };
            const invalidData3 = null;

            expect(quotesService._validateQuotesData(validData)).toBe(true);
            expect(quotesService._validateQuotesData(invalidData1)).toBe(false);
            expect(quotesService._validateQuotesData(invalidData2)).toBe(false);
            expect(quotesService._validateQuotesData(invalidData3)).toBe(false);
        });
    });

    describe('TaskSummaryService', () => {
        it('should export functional interface', () => {
            expect(typeof taskSummaryService.generateSummaryForUser).toBe(
                'function'
            );
            expect(typeof taskSummaryService.sendSummaryToUser).toBe(
                'function'
            );
            expect(typeof taskSummaryService.calculateNextRunTime).toBe(
                'function'
            );
        });

        it('should have pure helper functions for testing', () => {
            expect(typeof taskSummaryService._escapeMarkdown).toBe('function');
            expect(typeof taskSummaryService._getPriorityEmoji).toBe(
                'function'
            );
            expect(typeof taskSummaryService._buildTaskSection).toBe(
                'function'
            );
        });

        it('should escape markdown correctly', () => {
            const text = 'Task with *bold* and _italic_ text';
            const escaped = taskSummaryService._escapeMarkdown(text);
            expect(escaped).toBe('Task with \\*bold\\* and \\_italic\\_ text');
        });

        it('should return correct priority emojis', () => {
            expect(taskSummaryService._getPriorityEmoji(0)).toBe('🟢'); // low
            expect(taskSummaryService._getPriorityEmoji(1)).toBe('🟠'); // medium
            expect(taskSummaryService._getPriorityEmoji(2)).toBe('🔴'); // high
            expect(taskSummaryService._getPriorityEmoji(99)).toBe('⚪'); // unknown
        });
    });
});
