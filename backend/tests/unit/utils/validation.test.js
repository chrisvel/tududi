const { validateTagName } = require('../../../modules/tags/tagsService');
const {
    validateDeferUntilAndDueDate,
} = require('../../../modules/tasks/utils/validation');

describe('validation utils', () => {
    describe('validateTagName', () => {
        it('should accept valid tag names', () => {
            const result = validateTagName('work');
            expect(result.valid).toBe(true);
            expect(result.name).toBe('work');
        });

        it('should accept tag names with colons', () => {
            const result = validateTagName('project:frontend');
            expect(result.valid).toBe(true);
            expect(result.name).toBe('project:frontend');
        });

        it('should accept tag names with multiple colons', () => {
            const result = validateTagName('category:project:frontend');
            expect(result.valid).toBe(true);
            expect(result.name).toBe('category:project:frontend');
        });

        it('should accept tag names with hyphens', () => {
            const result = validateTagName('project-frontend');
            expect(result.valid).toBe(true);
            expect(result.name).toBe('project-frontend');
        });

        it('should accept tag names with multiple hyphens', () => {
            const result = validateTagName('my-awesome-project-tag');
            expect(result.valid).toBe(true);
            expect(result.name).toBe('my-awesome-project-tag');
        });

        it('should trim whitespace', () => {
            const result = validateTagName('  work  ');
            expect(result.valid).toBe(true);
            expect(result.name).toBe('work');
        });

        it('should reject empty tag names', () => {
            const result = validateTagName('');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Tag name is required');
        });

        it('should reject tag names with only whitespace', () => {
            const result = validateTagName('   ');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Tag name is required');
        });

        it('should reject null or undefined tag names', () => {
            expect(validateTagName(null).valid).toBe(false);
            expect(validateTagName(undefined).valid).toBe(false);
        });

        it('should reject tag names with invalid characters', () => {
            const invalidChars = [
                '#',
                '%',
                '&',
                '{',
                '}',
                '\\',
                '<',
                '>',
                '*',
                '?',
                '/',
                '$',
                '!',
                "'",
                '"',
                '@',
                '+',
                '`',
                '|',
                '=',
            ];

            invalidChars.forEach((char) => {
                const result = validateTagName(`invalid${char}tag`);
                expect(result.valid).toBe(false);
                expect(result.error).toContain('invalid characters');
            });
        });

        it('should reject tag names longer than 50 characters', () => {
            const longName = 'a'.repeat(51);
            const result = validateTagName(longName);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Tag name must be 50 characters or less');
        });

        it('should accept tag names up to 50 characters', () => {
            const maxLengthName = 'a'.repeat(50);
            const result = validateTagName(maxLengthName);
            expect(result.valid).toBe(true);
            expect(result.name).toBe(maxLengthName);
        });

        it('should accept tag names with hyphens and underscores', () => {
            const result1 = validateTagName('my-tag');
            const result2 = validateTagName('my_tag');

            expect(result1.valid).toBe(true);
            expect(result1.name).toBe('my-tag');
            expect(result2.valid).toBe(true);
            expect(result2.name).toBe('my_tag');
        });

        it('should accept tag names with numbers', () => {
            const result = validateTagName('version-1.2');
            expect(result.valid).toBe(true);
            expect(result.name).toBe('version-1.2');
        });
    });

    describe('validateDeferUntilAndDueDate', () => {
        describe('non-recurring tasks', () => {
            it('should allow defer_until before due_date', () => {
                expect(() => {
                    validateDeferUntilAndDueDate('2026-03-05', '2026-03-10');
                }).not.toThrow();
            });

            it('should reject defer_until after due_date', () => {
                expect(() => {
                    validateDeferUntilAndDueDate('2026-03-15', '2026-03-10');
                }).toThrow('Defer until date cannot be after the due date.');
            });

            it('should allow defer_until equal to due_date', () => {
                expect(() => {
                    validateDeferUntilAndDueDate('2026-03-10', '2026-03-10');
                }).not.toThrow();
            });
        });

        describe('recurring task instances', () => {
            it('should allow defer_until after due_date but before recurrence_end_date', () => {
                expect(() => {
                    validateDeferUntilAndDueDate(
                        '2026-03-15', // defer_until
                        '2026-03-10', // due_date
                        '2026-03-20' // recurrence_end_date
                    );
                }).not.toThrow();
            });

            it('should reject defer_until after recurrence_end_date', () => {
                expect(() => {
                    validateDeferUntilAndDueDate(
                        '2026-03-25', // defer_until
                        '2026-03-10', // due_date
                        '2026-03-20' // recurrence_end_date
                    );
                }).toThrow(
                    'Defer until date cannot be after the recurring task end date.'
                );
            });

            it('should allow any defer_until when no recurrence_end_date', () => {
                expect(() => {
                    validateDeferUntilAndDueDate(
                        '2026-12-31', // defer_until far in future
                        '2026-03-10', // due_date
                        null // no end date
                    );
                }).not.toThrow();
            });

            it('should allow defer_until equal to recurrence_end_date', () => {
                expect(() => {
                    validateDeferUntilAndDueDate(
                        '2026-03-20', // defer_until
                        '2026-03-10', // due_date
                        '2026-03-20' // recurrence_end_date
                    );
                }).not.toThrow();
            });

            it('should allow defer_until before due_date with recurrence_end_date', () => {
                expect(() => {
                    validateDeferUntilAndDueDate(
                        '2026-03-05', // defer_until before due
                        '2026-03-10', // due_date
                        '2026-03-20' // recurrence_end_date
                    );
                }).not.toThrow();
            });
        });

        describe('edge cases', () => {
            it('should not throw when defer_until is null', () => {
                expect(() => {
                    validateDeferUntilAndDueDate(null, '2026-03-10');
                }).not.toThrow();
            });

            it('should not throw when due_date is null', () => {
                expect(() => {
                    validateDeferUntilAndDueDate('2026-03-10', null);
                }).not.toThrow();
            });

            it('should not throw when both are null', () => {
                expect(() => {
                    validateDeferUntilAndDueDate(null, null);
                }).not.toThrow();
            });

            it('should not throw for invalid defer_until date string', () => {
                expect(() => {
                    validateDeferUntilAndDueDate('invalid', '2026-03-10');
                }).not.toThrow();
            });

            it('should not throw for invalid due_date string', () => {
                expect(() => {
                    validateDeferUntilAndDueDate('2026-03-10', 'invalid');
                }).not.toThrow();
            });

            it('should not throw for invalid recurrence_end_date but still enforce due_date', () => {
                expect(() => {
                    validateDeferUntilAndDueDate(
                        '2026-03-15',
                        '2026-03-10',
                        'invalid'
                    );
                }).not.toThrow(); // Invalid end date means no end date (infinite)
            });
        });
    });
});
