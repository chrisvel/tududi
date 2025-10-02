const { validateTagName } = require('../../../services/tagsService');

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
});
